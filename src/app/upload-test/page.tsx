"use client";

import {
  CheckCircle2,
  CloudUpload,
  FileVideo,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { useUploadManager } from "@/components/providers/upload-provider";
import { formatFileSize } from "@/lib/format";

export default function UploadTestPage() {
  const upload = useUploadManager();
  const isActive = [
    "preparing",
    "uploading",
    "finalizing",
    "waiting_processing",
    "queued",
    "processing",
    "cancelling",
  ].includes(upload.phase);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-medium text-primary">
          Development diagnostic
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
          Resumable upload test
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This route uses the same application-level upload manager as the
          main New recording flow.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            {upload.phase === "failed" ? (
              <TriangleAlert aria-hidden="true" className="size-4.5" />
            ) : upload.phase === "completed" ? (
              <CheckCircle2 aria-hidden="true" className="size-4.5" />
            ) : isActive ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4.5 animate-spin motion-reduce:animate-none"
              />
            ) : upload.savedSession ? (
              <FileVideo aria-hidden="true" className="size-4.5" />
            ) : (
              <CloudUpload aria-hidden="true" className="size-4.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              {upload.savedSession
                ? upload.savedSession.fileName
                : "No resumable upload stored"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Phase: {upload.phase.replaceAll("_", " ")}
              {upload.savedSession
                ? ` · ${formatFileSize(upload.savedSession.fileSize)}`
                : ""}
            </p>
          </div>
        </div>

        {upload.progress > 0 ? (
          <div className="mt-5">
            <div className="flex justify-between text-xs">
              <span>Verified and transferred</span>
              <span className="tabular-nums text-muted-foreground">
                {upload.progress}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${upload.progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {upload.error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-destructive/8 px-3 py-2.5 text-xs text-destructive"
          >
            {upload.error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={upload.openDialog}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <CloudUpload aria-hidden="true" className="size-4" />
          {upload.savedSession ? "Open resume flow" : "Open upload flow"}
        </button>
      </section>

      <p className="text-xs leading-5 text-muted-foreground">
        Close the dialog or navigate elsewhere while uploading to verify
        that the transfer remains owned by the root provider. Refresh to
        verify that the persisted session requests the original file
        again.
      </p>
    </div>
  );
}
