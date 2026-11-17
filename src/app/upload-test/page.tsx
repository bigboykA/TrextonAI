
"use client";

import { useState, useSyncExternalStore } from "react";

const MAX_SIZE = 512 * 1024 * 1024;
const CONCURRENCY = 3;
const MAX_RETRIES = 3;
const LOCAL_SESSION_KEY = "trexton.uploadSession.v1";

/**
 * File identity for resume matching.
 * Uses name + size + lastModified. This is NOT cryptographic:
 * copies can change lastModified, and colliding names/sizes are possible.
 */
function fileFingerprint(file: File) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

type Session = {
  sessionId: string;
  resumeToken: string;
  videoId: string;
  key: string;
  fileName: string;
  fileSize: number;
  partSize: number;
  partCount: number;
  fileFingerprint: string;
  status: string;
};

type RecoveredPart = {
  partNumber: number;
  size: number;
};

type LocalSession = {
  sessionId: string;
  resumeToken: string;
  fileName: string;
  fileSize: number;
  fileFingerprint: string;
};

type ApiErrorBody = {
  error?: string;
};

async function api<T>(data: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/uploads/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = (await response.json()) as T & ApiErrorBody;

  if (!response.ok) {
    throw new Error(body.error ?? "Upload API failed");
  }

  return body;
}

function loadLocalSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LocalSession;

    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.resumeToken !== "string" ||
      typeof parsed.fileName !== "string" ||
      typeof parsed.fileSize !== "number" ||
      typeof parsed.fileFingerprint !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveLocalSession(session: LocalSession) {
  try {
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private browsing / quota — recovery just won't survive refresh.
  }
  notifyLocalSessionListeners();
}

function clearLocalSession() {
  try {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
  notifyLocalSessionListeners();
}

const localSessionListeners = new Set<() => void>();

function notifyLocalSessionListeners() {
  for (const listener of localSessionListeners) {
    listener();
  }
}

function subscribeLocalSession(listener: () => void) {
  localSessionListeners.add(listener);
  return () => {
    localSessionListeners.delete(listener);
  };
}

function getLocalSessionSnapshot() {
  return loadLocalSession();
}

function getLocalSessionServerSnapshot(): LocalSession | null {
  return null;
}

async function uploadPart(
  file: File,
  session: Session,
  index: number
) {
  const partNumber = index + 1;
  const start = index * session.partSize;
  const end = Math.min(start + session.partSize, file.size);
  const chunk = file.slice(start, end);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { url } = await api<{ url: string }>({
        action: "sign",
        sessionId: session.sessionId,
        resumeToken: session.resumeToken,
        partNumber,
      });

      const response = await fetch(url, {
        method: "PUT",
        body: chunk,
      });

      if (!response.ok) {
        throw new Error(
          `Part ${partNumber} failed: HTTP ${response.status}`
        );
      }

      return chunk.size;
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) throw error;

      await new Promise((resolve) =>
        setTimeout(resolve, 500 * 2 ** attempt)
      );
    }
  }

  throw new Error(`Part ${partNumber} failed`);
}

export default function UploadTestPage() {
  const pending = useSyncExternalStore(
    subscribeLocalSession,
    getLocalSessionSnapshot,
    getLocalSessionServerSnapshot
  );
  const [status, setStatus] = useState("Choose an MP4");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const displayStatus =
    pending && status === "Choose an MP4"
      ? `Unfinished upload found: ${pending.fileName}. Re-select that exact file to resume, or cancel.`
      : status;

  async function cancelPending() {
    if (!pending || busy) return;

    setBusy(true);
    setStatus("Cancelling unfinished upload...");

    try {
      await api({
        action: "abort",
        sessionId: pending.sessionId,
        resumeToken: pending.resumeToken,
      });
    } catch {
      // Session may already be gone in R2/DB.
    }

    clearLocalSession();
    setProgress(0);
    setStatus("Cancelled. Choose an MP4 to start a new upload.");
    setBusy(false);
  }

  async function upload(file: File) {
    if (busy) return;

    if (
      !file.name.toLowerCase().endsWith(".mp4") ||
      file.size === 0 ||
      file.size > MAX_SIZE
    ) {
      setStatus("Select an MP4 under 512 MiB");
      return;
    }

    const fingerprint = fileFingerprint(file);
    setBusy(true);
    setProgress(0);

    let session: Session | null = null;

    try {
      const saved = pending ?? loadLocalSession();

      if (saved) {
        if (saved.fileFingerprint !== fingerprint) {
          setStatus(
            `Selected file does not match unfinished upload (${saved.fileName}, ${saved.fileSize} bytes). Re-select the original file or cancel the pending upload.`
          );
          return;
        }

        setStatus("Recovering upload session from R2...");

        const recovered = await api<
          Session & {
            parts: RecoveredPart[];
            uploadedBytes: number;
            completed: boolean;
          }
        >({
          action: "recover",
          sessionId: saved.sessionId,
          resumeToken: saved.resumeToken,
        });

        if (recovered.completed) {
          clearLocalSession();
          setProgress(100);
          setStatus(`Upload already complete! ${recovered.key}`);
          return;
        }

        session = recovered;
        saveLocalSession({
          sessionId: recovered.sessionId,
          resumeToken: recovered.resumeToken,
          fileName: recovered.fileName,
          fileSize: recovered.fileSize,
          fileFingerprint: recovered.fileFingerprint,
        });

        const uploadedPartNumbers = new Set(
          recovered.parts.map((part) => part.partNumber)
        );
        const missingIndexes = Array.from(
          { length: recovered.partCount },
          (_, index) => index
        ).filter(
          (index) => !uploadedPartNumbers.has(index + 1)
        );

        let completedBytes = recovered.uploadedBytes;
        setProgress(
          Math.round((completedBytes / file.size) * 100)
        );
        setStatus(
          missingIndexes.length === 0
            ? "All parts verified. Finalizing..."
            : `Resuming... ${missingIndexes.length} parts remaining`
        );

        let cursor = 0;

        async function resumeWorker() {
          while (cursor < missingIndexes.length) {
            const index = missingIndexes[cursor++];
            const bytes = await uploadPart(file, session!, index);
            completedBytes += bytes;
            const percentage = Math.round(
              (completedBytes / file.size) * 100
            );
            setProgress(percentage);
            setStatus(`Uploading... ${percentage}%`);
          }
        }

        await Promise.all(
          Array.from(
            {
              length: Math.min(CONCURRENCY, missingIndexes.length || 1),
            },
            () => resumeWorker()
          )
        );
      } else {
        setStatus("Starting multipart upload...");

        const activeSession = await api<Session>({
          action: "init",
          fileName: file.name,
          fileSize: file.size,
          fileFingerprint: fingerprint,
        });

        session = activeSession;
        saveLocalSession({
          sessionId: activeSession.sessionId,
          resumeToken: activeSession.resumeToken,
          fileName: activeSession.fileName,
          fileSize: activeSession.fileSize,
          fileFingerprint: activeSession.fileFingerprint,
        });

        const indexes = Array.from(
          { length: activeSession.partCount },
          (_, index) => index
        );
        let nextIndex = 0;
        let completedBytes = 0;

        async function worker() {
          while (nextIndex < indexes.length) {
            const index = nextIndex++;
            const bytes = await uploadPart(
              file,
              activeSession,
              index
            );
            completedBytes += bytes;
            const percentage = Math.round(
              (completedBytes / file.size) * 100
            );
            setProgress(percentage);
            setStatus(`Uploading... ${percentage}%`);
          }
        }

        await Promise.all(
          Array.from(
            {
              length: Math.min(CONCURRENCY, activeSession.partCount),
            },
            () => worker()
          )
        );
      }

      if (!session) {
        throw new Error("Missing upload session");
      }

      setStatus("Finalizing recording...");

      const result = await api<{ key: string }>({
        action: "complete",
        sessionId: session.sessionId,
        resumeToken: session.resumeToken,
      });

      clearLocalSession();
      setStatus(`Upload complete! ${result.key}`);
      setProgress(100);
      session = null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed";

      setStatus(message);

      // Keep session for recoverable failures (network, part retries).
      // Only clear when the server says the session is gone/terminal.
      const terminal =
        /not found|aborted|no longer available|failed/i.test(
          message
        );

      if (terminal) {
        clearLocalSession();
      } else if (session) {
        saveLocalSession({
          sessionId: session.sessionId,
          resumeToken: session.resumeToken,
          fileName: session.fileName,
          fileSize: session.fileSize,
          fileFingerprint: session.fileFingerprint,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-10">
      <h1 className="mb-6 text-2xl font-semibold">
        Trexton Multipart Upload Test
      </h1>

      <p className="mb-4 text-sm text-muted-foreground">
        Refresh-safe resume uses PostgreSQL session state plus R2
        ListParts. File identity is name|size|lastModified — re-select
        the original file after refresh.
      </p>

      <input
        type="file"
        accept=".mp4,video/mp4"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />

      {pending ? (
        <button
          type="button"
          className="mt-4 rounded border px-3 py-1.5 text-sm"
          disabled={busy}
          onClick={() => void cancelPending()}
        >
          Cancel unfinished upload
        </button>
      ) : null}

      <div className="mt-6">
        <progress
          className="w-full"
          max={100}
          value={progress}
          aria-label="Upload progress"
        />
        <p className="mt-3 break-all text-sm" suppressHydrationWarning>
          {displayStatus}
        </p>
      </div>
    </main>
  );
}
