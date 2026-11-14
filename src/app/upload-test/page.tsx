
"use client";

import { useState } from "react";

const MAX_SIZE = 512 * 1024 * 1024;
const CONCURRENCY = 3;
const MAX_RETRIES = 3;

type Session = {
  videoId: string;
  uploadId: string;
  key: string;
  partSize: number;
  partCount: number;
};

async function api<T>(data: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/uploads/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? "Upload API failed");
  }

  return body as T;
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
        videoId: session.videoId,
        uploadId: session.uploadId,
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
  const [status, setStatus] = useState("Choose an MP4");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

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

    setBusy(true);
    setProgress(0);
    setStatus("Starting multipart upload...");

    let session: Session | null = null;

    try {
      const activeSession = await api<Session>({
        action: "init",
        fileName: file.name,
        fileSize: file.size,
      });
      session = activeSession;

      let nextIndex = 0;
      let completedBytes = 0;

      async function worker() {
        while (nextIndex < activeSession.partCount) {
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
            length: Math.min(
              CONCURRENCY,
              activeSession.partCount
            ),
          },
          () => worker()
        )
      );

      setStatus("Finalizing recording...");

      const result = await api<{ key: string }>({
        action: "complete",
        videoId: activeSession.videoId,
        uploadId: activeSession.uploadId,
        fileSize: file.size,
      });

      setStatus(`Upload complete! ${result.key}`);
      setProgress(100);
      session = null;
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Upload failed"
      );

      if (session) {
        // Best effort cleanup of incomplete upload.
        // An in-flight part may still be finishing.
        try {
          await api({
            action: "abort",
            videoId: session.videoId,
            uploadId: session.uploadId,
          });
        } catch {
          // R2 lifecycle cleanup is the fallback.
        }
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

      <div className="mt-6">
        <progress
          className="w-full"
          max={100}
          value={progress}
          aria-label="Upload progress"
        />
        <p className="mt-3 break-all text-sm">
          {status}
        </p>
      </div>
    </main>
  );
}
