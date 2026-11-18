"use client";

import { useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import {
  CheckCircle2,
  FileVideo,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import { useUploadManager } from "@/components/providers/upload-provider";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import { MAX_UPLOAD_SIZE } from "@/lib/uploads/multipart-client";
import { cn } from "@/lib/utils";

const phaseLabels = {
  preparing: "Preparing secure upload",
  uploading: "Uploading recording",
  finalizing: "Finalizing upload",
  waiting_processing: "Waiting for processing",
  queued: "Queued for processing",
  processing: "Processing recording",
  completed: "Highlights ready",
  cancelling: "Cancelling upload",
} as const;

export function NewRecordingDialog() {
  const upload = useUploadManager();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isBusy = [
    "preparing",
    "uploading",
    "finalizing",
    "cancelling",
  ].includes(upload.phase);
  const isPostUpload =
    Boolean(upload.videoId) &&
    [
      "waiting_processing",
      "queued",
      "processing",
      "completed",
      "failed",
    ].includes(upload.phase);
  const selectedFile = upload.file;
  const displayName =
    selectedFile?.name ?? upload.savedSession?.fileName ?? null;
  const displaySize =
    selectedFile?.size ?? upload.savedSession?.fileSize ?? null;

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isBusy || isPostUpload) return;

    const file = event.dataTransfer.files[0];
    if (file) upload.selectFile(file);
  };

  return (
    <Dialog.Root
      open={upload.isDialogOpen}
      onOpenChange={(open) =>
        open ? upload.openDialog() : upload.closeDialog()
      }
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
          <Dialog.Popup className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-2xl outline-none sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-tight">
                  New recording
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-6 text-muted-foreground">
                  Upload an MP4 for automatic transcription and highlight
                  generation.
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close upload dialog"
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:size-9"
              >
                <X aria-hidden="true" className="size-4" />
              </Dialog.Close>
            </div>

            {isPostUpload ? (
              <div className="mt-6 rounded-2xl border border-border bg-background/65 p-5 text-center">
                <div
                  className={cn(
                    "mx-auto grid size-11 place-items-center rounded-full",
                    upload.phase === "failed"
                      ? "bg-destructive/10 text-destructive"
                      : upload.phase === "completed"
                        ? "bg-success/12 text-success"
                        : "bg-primary/10 text-primary"
                  )}
                >
                  {upload.phase === "completed" ? (
                    <CheckCircle2 aria-hidden="true" className="size-5" />
                  ) : (
                    <LoaderCircle
                      aria-hidden="true"
                      className={cn(
                        "size-5",
                        upload.phase !== "failed" &&
                          "animate-spin motion-reduce:animate-none"
                      )}
                    />
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold">
                  {upload.phase === "failed"
                    ? "Processing needs attention"
                    : phaseLabels[
                        upload.phase as keyof typeof phaseLabels
                      ]}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {upload.phase === "completed"
                    ? "Your generated highlights are available in the library."
                    : upload.phase === "failed"
                      ? upload.error ??
                        "The recording could not be processed. Review Activity for details."
                      : "The upload is safely stored. You can close this window while processing continues."}
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={upload.startAnotherUpload}
                  >
                    Upload another
                  </Button>
                  <Button
                    render={<Link href="/processing" />}
                    onClick={upload.closeDialog}
                  >
                    View activity
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <label
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (!isBusy) setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "mt-6 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background/55 hover:border-primary/45 hover:bg-primary/[0.025]",
                    isBusy && "pointer-events-none opacity-65"
                  )}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="video/mp4,.mp4"
                    className="sr-only"
                    disabled={isBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) upload.selectFile(file);
                      event.target.value = "";
                    }}
                  />
                  <div className="grid size-11 place-items-center rounded-2xl border border-border bg-card text-primary shadow-sm">
                    <UploadCloud aria-hidden="true" className="size-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">
                    {upload.savedSession && !selectedFile
                      ? "Reselect the original recording"
                      : "Drop an MP4 recording here"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {upload.savedSession && !selectedFile
                      ? "A resumable session was found. The local file is required again after a refresh."
                      : "or click to browse your files"}
                  </p>
                  <span className="mt-3 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                    MP4 · up to {formatFileSize(MAX_UPLOAD_SIZE)}
                  </span>
                </label>

                {displayName ? (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background/65 p-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FileVideo aria-hidden="true" className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {displayName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {displaySize ? formatFileSize(displaySize) : "MP4"}
                        {upload.savedSession && !selectedFile
                          ? " · ready to resume"
                          : ""}
                      </p>
                    </div>
                    {selectedFile && !isBusy ? (
                      <button
                        type="button"
                        aria-label="Remove selected file"
                        onClick={upload.clearFile}
                        className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:size-8"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {isBusy || upload.progress > 0 ? (
                  <div className="mt-4" aria-live="polite">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">
                        {phaseLabels[
                          upload.phase as keyof typeof phaseLabels
                        ] ?? "Upload paused"}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {upload.progress}%
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label="Recording upload progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={upload.progress}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {formatFileSize(upload.uploadedBytes)} uploaded
                    </p>
                  </div>
                ) : null}

                {upload.error ? (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl bg-destructive/8 px-3 py-2.5 text-xs leading-5 text-destructive"
                  >
                    {upload.error}
                  </p>
                ) : null}

                <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
                  Resume identity uses the file name, size, and modified time.
                  It detects common mismatches but is not a cryptographic
                  content check.
                </p>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {upload.savedSession ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={upload.phase === "cancelling"}
                      onClick={() => void upload.cancelUpload()}
                    >
                      {upload.phase === "cancelling"
                        ? "Cancelling…"
                        : "Cancel upload"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={upload.closeDialog}
                    >
                      Close
                    </Button>
                  )}
                  <Button
                    type="button"
                    disabled={!selectedFile || isBusy}
                    onClick={() => void upload.startUpload()}
                  >
                    {upload.savedSession
                      ? upload.phase === "failed"
                        ? "Try resume again"
                        : "Resume upload"
                      : "Upload recording"}
                  </Button>
                </div>
              </>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
