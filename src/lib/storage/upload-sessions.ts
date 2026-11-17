
import { and, eq, inArray } from "drizzle-orm";
import {
  AbortMultipartUploadCommand,
  ListPartsCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { db } from "@/db";
import { uploadSessions } from "@/db/schema";

export type UploadSession = typeof uploadSessions.$inferSelect;

export type UploadSessionStatus =
  | "initiated"
  | "uploading"
  | "completing"
  | "completed"
  | "failed"
  | "aborted";

export type ListedPart = {
  partNumber: number;
  size: number;
  etag: string;
};

export const ACTIVE_STATUSES: UploadSessionStatus[] = [
  "initiated",
  "uploading",
  "completing",
];

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export function uploadObjectKey(videoId: string) {
  if (!isUuid(videoId)) {
    throw new Error("Invalid video ID");
  }

  return `originals/${videoId}/source.mp4`;
}

export function expectedPartSize(
  fileSize: number,
  partSize: number,
  partNumber: number
) {
  const start = (partNumber - 1) * partSize;
  return Math.min(partSize, fileSize - start);
}

export async function getAuthorizedSession(
  sessionId: unknown,
  resumeToken: unknown
) {
  if (!isUuid(sessionId) || !isUuid(resumeToken)) {
    return null;
  }

  const [session] = await db
    .select()
    .from(uploadSessions)
    .where(
      and(
        eq(uploadSessions.id, sessionId),
        eq(uploadSessions.resumeToken, resumeToken)
      )
    )
    .limit(1);

  return session ?? null;
}

export async function touchSession(
  sessionId: string,
  status?: UploadSessionStatus
) {
  await db
    .update(uploadSessions)
    .set({
      ...(status ? { status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(uploadSessions.id, sessionId));
}

export async function markSessionFailed(sessionId: string) {
  await db
    .update(uploadSessions)
    .set({
      status: "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(uploadSessions.id, sessionId),
        inArray(uploadSessions.status, ACTIVE_STATUSES)
      )
    );
}

export async function listAllParts(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string
): Promise<ListedPart[]> {
  const parts: ListedPart[] = [];
  let partNumberMarker: string | undefined;

  for (;;) {
    const result = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: partNumberMarker,
      })
    );

    for (const part of result.Parts ?? []) {
      if (
        typeof part.PartNumber === "number" &&
        typeof part.Size === "number" &&
        typeof part.ETag === "string"
      ) {
        parts.push({
          partNumber: part.PartNumber,
          size: part.Size,
          etag: part.ETag,
        });
      }
    }

    if (!result.IsTruncated) {
      break;
    }

    partNumberMarker =
      result.NextPartNumberMarker ??
      String(parts.at(-1)?.partNumber ?? "");

    if (!partNumberMarker) {
      break;
    }
  }

  return parts.sort((a, b) => a.partNumber - b.partNumber);
}

export function verifyListedParts(
  parts: ListedPart[],
  fileSize: number,
  partSize: number,
  partCount: number
) {
  if (parts.length !== partCount) {
    return "Not all parts were uploaded";
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const expected = expectedPartSize(fileSize, partSize, i + 1);

    if (part.partNumber !== i + 1 || part.size !== expected) {
      return "Part order or size mismatch";
    }
  }

  return null;
}

export async function abortRemoteUpload(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string
) {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    })
  );
}
