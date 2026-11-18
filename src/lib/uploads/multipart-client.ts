export const MAX_UPLOAD_SIZE = 512 * 1024 * 1024;
export const UPLOAD_CONCURRENCY = 3;
export const MAX_PART_ATTEMPTS = 3;

export type SavedUploadSession = {
  sessionId: string;
  resumeToken: string;
  videoId: string;
  fileName: string;
  fileSize: number;
  fileFingerprint: string;
  partSize: number;
  partCount: number;
};

export type UploadedPart = {
  partNumber: number;
  size: number;
};

export type RecoveredUpload = SavedUploadSession & {
  status:
    | "initiated"
    | "uploading"
    | "completing"
    | "completed"
    | "failed"
    | "aborted";
  parts: UploadedPart[];
  uploadedBytes: number;
  completed: boolean;
  processingJobId?: string;
  publicationStatus?: "pending" | "claimed" | "published";
  submissionStatus?: "awaiting_publication" | "queued";
};

export type CompletedUpload = {
  success: true;
  sessionId: string;
  videoId: string;
  size: number;
  alreadyCompleted?: boolean;
  processingJobId: string;
  publicationStatus: "pending" | "claimed" | "published";
  submissionStatus: "awaiting_publication" | "queued";
};

export function fileFingerprint(file: File) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function validateUploadFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".mp4")) {
    throw new Error("Choose an MP4 recording.");
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
    throw new Error("Choose an MP4 recording smaller than 512 MiB.");
  }
}

async function readJson<T>(
  response: Response,
  fallback: string
): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? fallback);
  }

  return payload as T;
}

async function multipartRequest<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal
) {
  const response = await fetch("/api/uploads/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  return readJson<T>(response, "The upload request failed.");
}

export async function initializeUpload(
  file: File,
  signal?: AbortSignal
) {
  validateUploadFile(file);

  return multipartRequest<SavedUploadSession>(
    {
      action: "init",
      fileName: file.name,
      fileSize: file.size,
      fileFingerprint: fileFingerprint(file),
    },
    signal
  );
}

export async function recoverUpload(
  session: SavedUploadSession,
  signal?: AbortSignal
) {
  return multipartRequest<RecoveredUpload>(
    {
      action: "recover",
      sessionId: session.sessionId,
      resumeToken: session.resumeToken,
    },
    signal
  );
}

function signPart(
  session: SavedUploadSession,
  partNumber: number,
  signal?: AbortSignal
) {
  return multipartRequest<{ url: string; partNumber: number }>(
    {
      action: "sign",
      sessionId: session.sessionId,
      resumeToken: session.resumeToken,
      partNumber,
    },
    signal
  );
}

function uploadPart(
  url: string,
  body: Blob,
  signal: AbortSignal | undefined,
  onProgress: (loaded: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    const abort = () => request.abort();
    signal?.addEventListener("abort", abort, { once: true });

    request.open("PUT", url);
    request.setRequestHeader("Content-Type", "video/mp4");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    });
    request.addEventListener("load", () => {
      signal?.removeEventListener("abort", abort);
      if (request.status >= 200 && request.status < 300) {
        onProgress(body.size);
        resolve();
      } else {
        reject(new Error(`Part upload failed (${request.status})`));
      }
    });
    request.addEventListener("error", () => {
      signal?.removeEventListener("abort", abort);
      reject(new Error("The network interrupted this upload part."));
    });
    request.addEventListener("abort", () => {
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Upload cancelled", "AbortError"));
    });
    request.send(body);
  });
}

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);

    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function uploadMissingParts({
  file,
  session,
  verifiedParts,
  signal,
  onProgress,
}: {
  file: File;
  session: SavedUploadSession;
  verifiedParts: UploadedPart[];
  signal?: AbortSignal;
  onProgress: (uploadedBytes: number, totalBytes: number) => void;
}) {
  const verifiedPartNumbers = new Set(
    verifiedParts.map((part) => part.partNumber)
  );
  const verifiedBytes = verifiedParts.reduce(
    (total, part) => total + part.size,
    0
  );
  const missingParts = Array.from(
    { length: session.partCount },
    (_, index) => index + 1
  ).filter((partNumber) => !verifiedPartNumbers.has(partNumber));
  const completedInRun = new Map<number, number>();
  const activeProgress = new Map<number, number>();

  const reportProgress = () => {
    const completedBytes = [...completedInRun.values()].reduce(
      (total, size) => total + size,
      0
    );
    const activeBytes = [...activeProgress.values()].reduce(
      (total, size) => total + size,
      0
    );
    onProgress(
      Math.min(file.size, verifiedBytes + completedBytes + activeBytes),
      file.size
    );
  };

  reportProgress();

  let cursor = 0;
  async function worker() {
    while (cursor < missingParts.length) {
      const partNumber = missingParts[cursor++];
      const start = (partNumber - 1) * session.partSize;
      const end = Math.min(start + session.partSize, file.size);
      const part = file.slice(start, end);
      let lastError: unknown;

      for (let attempt = 0; attempt < MAX_PART_ATTEMPTS; attempt += 1) {
        if (signal?.aborted) {
          throw new DOMException("Upload cancelled", "AbortError");
        }

        try {
          activeProgress.set(partNumber, 0);
          const signed = await signPart(session, partNumber, signal);
          await uploadPart(signed.url, part, signal, (loaded) => {
            activeProgress.set(partNumber, loaded);
            reportProgress();
          });
          activeProgress.delete(partNumber);
          completedInRun.set(partNumber, part.size);
          reportProgress();
          lastError = null;
          break;
        } catch (error) {
          activeProgress.delete(partNumber);
          reportProgress();
          lastError = error;

          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            throw error;
          }

          if (attempt < MAX_PART_ATTEMPTS - 1) {
            await delay(500 * 2 ** attempt, signal);
          }
        }
      }

      if (lastError) throw lastError;
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(UPLOAD_CONCURRENCY, missingParts.length) },
      () => worker()
    )
  );
}

export function completeUpload(
  session: SavedUploadSession,
  signal?: AbortSignal
) {
  return multipartRequest<CompletedUpload>(
    {
      action: "complete",
      sessionId: session.sessionId,
      resumeToken: session.resumeToken,
    },
    signal
  );
}

export function abortUpload(session: SavedUploadSession) {
  return multipartRequest<{ aborted: true }>({
    action: "abort",
    sessionId: session.sessionId,
    resumeToken: session.resumeToken,
  });
}
