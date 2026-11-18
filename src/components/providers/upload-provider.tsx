"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useJob } from "@/hooks/use-job";
import { notifyTrextonDataChanged } from "@/hooks/use-recordings";
import {
  abortUpload,
  completeUpload,
  fileFingerprint,
  initializeUpload,
  recoverUpload,
  uploadMissingParts,
  validateUploadFile,
  type CompletedUpload,
  type SavedUploadSession,
} from "@/lib/uploads/multipart-client";
import {
  clearSavedUploadSession,
  getSavedUploadServerSnapshot,
  getSavedUploadSnapshot,
  saveUploadSession,
  subscribeToSavedUpload,
} from "@/lib/uploads/upload-session-store";
import { useWorkspace } from "./workspace-provider";

export type UploadPhase =
  | "idle"
  | "awaiting_file"
  | "ready"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "waiting_processing"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelling";

type UploadState = {
  phase: UploadPhase;
  file: File | null;
  progress: number;
  uploadedBytes: number;
  error: string | null;
  processingJobId: string | null;
  videoId: string | null;
};

type UploadContextValue = UploadState & {
  isDialogOpen: boolean;
  savedSession: SavedUploadSession | null;
  backgroundJobPhase: UploadPhase | null;
  openDialog: () => void;
  closeDialog: () => void;
  selectFile: (file: File) => void;
  clearFile: () => void;
  startUpload: () => Promise<void>;
  cancelUpload: () => Promise<void>;
  startAnotherUpload: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

const initialState: UploadState = {
  phase: "idle",
  file: null,
  progress: 0,
  uploadedBytes: 0,
  error: null,
  processingJobId: null,
  videoId: null,
};

function jobPhase(
  status:
    | "awaiting_publication"
    | "queued"
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | undefined
): UploadPhase | null {
  if (status === "awaiting_publication" || status === "pending") {
    return "waiting_processing";
  }
  if (status === "queued") return "queued";
  if (status === "processing") return "processing";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return null;
}

function friendlyUploadError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "The upload could not continue.";

  if (/network|fetch|part upload/i.test(message)) {
    return "The connection was interrupted. Your uploaded parts are saved; resume when you are online.";
  }
  return message;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const { activeJobId, setActiveJobId, setActiveVideoId } =
    useWorkspace();
  const savedSession = useSyncExternalStore(
    subscribeToSavedUpload,
    getSavedUploadSnapshot,
    getSavedUploadServerSnapshot
  );
  const [state, setState] = useState<UploadState>(initialState);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);

  const trackedJobId = state.processingJobId ?? activeJobId;
  const { job } = useJob(trackedJobId);
  const currentJobPhase = jobPhase(
    job?.submissionStatus ?? job?.status
  );
  const backgroundJobPhase =
    trackedJobId && currentJobPhase ? currentJobPhase : null;

  let phase = state.phase;
  if (
    state.processingJobId &&
    currentJobPhase &&
    ["waiting_processing", "queued", "processing"].includes(state.phase)
  ) {
    phase = currentJobPhase;
  } else if (
    state.phase === "idle" &&
    savedSession
  ) {
    phase = "awaiting_file";
  }

  const openDialog = useCallback(() => setIsDialogOpen(true), []);
  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  const selectFile = useCallback(
    (file: File) => {
      try {
        validateUploadFile(file);

        if (
          savedSession &&
          fileFingerprint(file) !== savedSession.fileFingerprint
        ) {
          throw new Error(
            "This is not the original recording. Select the same file name, size, and modified version to resume."
          );
        }

        setState((current) => ({
          ...current,
          phase: "ready",
          file,
          progress: savedSession
            ? current.progress
            : 0,
          uploadedBytes: savedSession
            ? current.uploadedBytes
            : 0,
          error: null,
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          phase: savedSession ? "awaiting_file" : "idle",
          file: null,
          error: friendlyUploadError(error),
        }));
      }
    },
    [savedSession]
  );

  const clearFile = useCallback(() => {
    setState((current) => ({
      ...current,
      phase: savedSession ? "awaiting_file" : "idle",
      file: null,
      error: null,
    }));
  }, [savedSession]);

  const applyCompletedUpload = useCallback(
    (result: CompletedUpload) => {
      clearSavedUploadSession();
      setActiveVideoId(result.videoId);
      setActiveJobId(result.processingJobId);
      setState((current) => ({
        ...current,
        phase:
          result.submissionStatus === "queued"
            ? "queued"
            : "waiting_processing",
        progress: 100,
        uploadedBytes: current.file?.size ?? result.size,
        error: null,
        processingJobId: result.processingJobId,
        videoId: result.videoId,
      }));
      notifyTrextonDataChanged();
    },
    [setActiveJobId, setActiveVideoId]
  );

  const startUpload = useCallback(async () => {
    const file = state.file;
    if (!file) {
      setState((current) => ({
        ...current,
        error: "Select the original MP4 recording first.",
      }));
      return;
    }

    cancelRequestedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      validateUploadFile(file);
      setState((current) => ({
        ...current,
        phase: "preparing",
        error: null,
      }));

      let session = getSavedUploadSnapshot();
      let verifiedParts: { partNumber: number; size: number }[] = [];

      if (session) {
        if (fileFingerprint(file) !== session.fileFingerprint) {
          throw new Error(
            "This is not the original recording. Select the same file name, size, and modified version to resume."
          );
        }

        const recovered = await recoverUpload(
          session,
          controller.signal
        );

        if (
          recovered.completed &&
          recovered.processingJobId &&
          recovered.publicationStatus &&
          recovered.submissionStatus
        ) {
          applyCompletedUpload({
            success: true,
            sessionId: recovered.sessionId,
            videoId: recovered.videoId,
            size: recovered.fileSize,
            alreadyCompleted: true,
            processingJobId: recovered.processingJobId,
            publicationStatus: recovered.publicationStatus,
            submissionStatus: recovered.submissionStatus,
          });
          return;
        }

        session = {
          sessionId: recovered.sessionId,
          resumeToken: recovered.resumeToken,
          videoId: recovered.videoId,
          fileName: recovered.fileName,
          fileSize: recovered.fileSize,
          fileFingerprint: recovered.fileFingerprint,
          partSize: recovered.partSize,
          partCount: recovered.partCount,
        };
        verifiedParts = recovered.parts;
        setState((current) => ({
          ...current,
          uploadedBytes: recovered.uploadedBytes,
          progress: Math.round(
            (recovered.uploadedBytes / file.size) * 100
          ),
        }));
      } else {
        session = await initializeUpload(file, controller.signal);
        saveUploadSession(session);
        notifyTrextonDataChanged();
      }

      setState((current) => ({
        ...current,
        phase: "uploading",
      }));

      await uploadMissingParts({
        file,
        session,
        verifiedParts,
        signal: controller.signal,
        onProgress: (uploadedBytes, totalBytes) => {
          setState((current) => ({
            ...current,
            uploadedBytes,
            progress: Math.min(
              100,
              Math.round((uploadedBytes / totalBytes) * 100)
            ),
          }));
        },
      });

      setState((current) => ({
        ...current,
        phase: "finalizing",
        progress: 100,
        uploadedBytes: file.size,
      }));
      const completed = await completeUpload(
        session,
        controller.signal
      );
      applyCompletedUpload(completed);
    } catch (error) {
      if (
        cancelRequestedRef.current ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }

      const message = error instanceof Error ? error.message : "";
      const sessionIsTerminal =
        /upload session (not found|is failed|is aborted|is no longer available)/i.test(
          message
        );

      if (sessionIsTerminal) {
        clearSavedUploadSession();
        notifyTrextonDataChanged();
      }

      setState((current) => ({
        ...current,
        phase: "failed",
        error: sessionIsTerminal
          ? "The previous resumable session expired or was closed. Start a new upload with this file."
          : friendlyUploadError(error),
      }));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [applyCompletedUpload, state.file]);

  const cancel = useCallback(async () => {
    cancelRequestedRef.current = true;
    abortControllerRef.current?.abort();
    const session = getSavedUploadSnapshot();

    if (!session) {
      setState(initialState);
      return;
    }

    setState((current) => ({
      ...current,
      phase: "cancelling",
      error: null,
    }));

    try {
      await abortUpload(session);
      clearSavedUploadSession();
      setState(initialState);
      setIsDialogOpen(false);
      notifyTrextonDataChanged();
    } catch (error) {
      cancelRequestedRef.current = false;
      setState((current) => ({
        ...current,
        phase: "failed",
        error:
          "Cancellation could not reach the server. The resumable session was kept so you can try again.",
      }));
      console.error("Failed to cancel upload:", error);
    }
  }, []);

  const startAnotherUpload = useCallback(() => {
    setState(initialState);
    setIsDialogOpen(true);
  }, []);

  const value = useMemo<UploadContextValue>(
    () => ({
      ...state,
      phase,
      isDialogOpen,
      savedSession,
      backgroundJobPhase,
      openDialog,
      closeDialog,
      selectFile,
      clearFile,
      startUpload,
      cancelUpload: cancel,
      startAnotherUpload,
    }),
    [
      backgroundJobPhase,
      cancel,
      clearFile,
      closeDialog,
      isDialogOpen,
      openDialog,
      phase,
      savedSession,
      selectFile,
      startAnotherUpload,
      startUpload,
      state,
    ]
  );

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUploadManager() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error(
      "useUploadManager must be used inside UploadProvider"
    );
  }
  return context;
}
