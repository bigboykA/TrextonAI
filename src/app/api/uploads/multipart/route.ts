
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/db";
import { uploadSessions } from "@/db/schema";
import { getR2Client, getR2Bucket } from "@/lib/storage/r2";
import {
  abortRemoteUpload,
  getAuthorizedSession,
  listAllParts,
  markSessionFailed,
  touchSession,
  uploadObjectKey,
  verifyListedParts,
  type UploadSession,
} from "@/lib/storage/upload-sessions";

export const runtime = "nodejs";

const PART_SIZE = 16 * 1024 * 1024;
const MAX_SIZE = 512 * 1024 * 1024;

function developmentOnly() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Unavailable" },
      { status: 403 }
    );
  }

  return null;
}

function sessionPayload(session: UploadSession) {
  return {
    sessionId: session.id,
    resumeToken: session.resumeToken,
    videoId: session.videoId,
    key: session.objectKey,
    fileName: session.fileName,
    fileSize: session.fileSize,
    partSize: session.partSize,
    partCount: session.partCount,
    fileFingerprint: session.fileFingerprint,
    status: session.status,
  };
}

type SessionLoad =
  | { ok: true; session: UploadSession }
  | { ok: false; response: NextResponse; session?: UploadSession };

async function requireActiveSession(
  sessionId: unknown,
  resumeToken: unknown
): Promise<SessionLoad> {
  const session = await getAuthorizedSession(sessionId, resumeToken);

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Upload session not found" },
        { status: 404 }
      ),
    };
  }

  if (
    session.status === "aborted" ||
    session.status === "failed"
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Upload session is ${session.status}` },
        { status: 409 }
      ),
      session,
    };
  }

  return { ok: true, session };
}

export async function POST(request: Request) {
  const blocked = developmentOnly();
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const client = getR2Client();
    const bucket = getR2Bucket();

    if (body.action === "init") {
      const { fileName, fileSize, fileFingerprint } = body;

      if (
        typeof fileName !== "string" ||
        !fileName.toLowerCase().endsWith(".mp4") ||
        !Number.isSafeInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > MAX_SIZE ||
        typeof fileFingerprint !== "string" ||
        fileFingerprint.length < 3 ||
        fileFingerprint.length > 1024
      ) {
        return NextResponse.json(
          { error: "Select an MP4 under 512 MiB" },
          { status: 400 }
        );
      }

      const videoId = randomUUID();
      const resumeToken = randomUUID();
      const key = uploadObjectKey(videoId);
      const partCount = Math.ceil(fileSize / PART_SIZE);

      const created = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          ContentType: "video/mp4",
        })
      );

      if (!created.UploadId) {
        throw new Error("R2 did not return an upload ID");
      }

      try {
        const [session] = await db
          .insert(uploadSessions)
          .values({
            videoId,
            resumeToken,
            r2UploadId: created.UploadId,
            objectKey: key,
            fileName,
            fileSize,
            partSize: PART_SIZE,
            partCount,
            fileFingerprint,
            status: "initiated",
          })
          .returning();

        return NextResponse.json(sessionPayload(session));
      } catch (error) {
        try {
          await abortRemoteUpload(
            client,
            bucket,
            key,
            created.UploadId
          );
        } catch (abortError) {
          console.error(
            "Failed to abort orphaned multipart upload:",
            abortError
          );
        }

        throw error;
      }
    }

    if (body.action === "recover") {
      const session = await getAuthorizedSession(
        body.sessionId,
        body.resumeToken
      );

      if (!session) {
        return NextResponse.json(
          { error: "Upload session not found" },
          { status: 404 }
        );
      }

      if (
        session.status === "aborted" ||
        session.status === "failed"
      ) {
        return NextResponse.json(
          { error: `Upload session is ${session.status}` },
          { status: 409 }
        );
      }

      if (session.status === "completed") {
        return NextResponse.json({
          ...sessionPayload(session),
          parts: [],
          uploadedBytes: session.fileSize,
          completed: true,
        });
      }

      try {
        const parts = await listAllParts(
          client,
          bucket,
          session.objectKey,
          session.r2UploadId
        );

        if (session.status === "initiated" && parts.length > 0) {
          await touchSession(session.id, "uploading");
          session.status = "uploading";
        } else {
          await touchSession(session.id);
        }

        const uploadedBytes = parts.reduce(
          (total, part) => total + part.size,
          0
        );

        return NextResponse.json({
          ...sessionPayload(session),
          parts: parts.map((part) => ({
            partNumber: part.partNumber,
            size: part.size,
          })),
          uploadedBytes,
          completed: false,
        });
      } catch (error) {
        console.error("Recover ListParts failed:", error);
        await markSessionFailed(session.id);

        return NextResponse.json(
          {
            error:
              "Upload session is no longer available in R2. Start a new upload.",
          },
          { status: 409 }
        );
      }
    }

    const loaded = await requireActiveSession(
      body.sessionId,
      body.resumeToken
    );

    if (!loaded.ok) {
      return loaded.response;
    }

    const session = loaded.session;

    if (body.action === "sign") {
      if (
        session.status !== "initiated" &&
        session.status !== "uploading"
      ) {
        return NextResponse.json(
          { error: `Cannot sign parts while ${session.status}` },
          { status: 409 }
        );
      }

      const partNumber = body.partNumber;

      if (
        !Number.isInteger(partNumber) ||
        partNumber < 1 ||
        partNumber > session.partCount
      ) {
        return NextResponse.json(
          { error: "Invalid part number" },
          { status: 400 }
        );
      }

      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: session.objectKey,
        UploadId: session.r2UploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(client, command, {
        expiresIn: 900,
      });

      if (session.status === "initiated") {
        await touchSession(session.id, "uploading");
      } else {
        await touchSession(session.id);
      }

      return NextResponse.json({ url, partNumber });
    }

    if (body.action === "complete") {
      if (session.status === "completed") {
        return NextResponse.json({
          success: true,
          sessionId: session.id,
          videoId: session.videoId,
          key: session.objectKey,
          size: session.fileSize,
          alreadyCompleted: true,
        });
      }

      if (
        session.status !== "initiated" &&
        session.status !== "uploading" &&
        session.status !== "completing"
      ) {
        return NextResponse.json(
          { error: `Cannot complete while ${session.status}` },
          { status: 409 }
        );
      }

      const claimed = await db
        .update(uploadSessions)
        .set({
          status: "completing",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(uploadSessions.id, session.id),
            inArray(uploadSessions.status, [
              "initiated",
              "uploading",
              "completing",
            ])
          )
        )
        .returning();

      if (claimed.length === 0) {
        const [latest] = await db
          .select()
          .from(uploadSessions)
          .where(eq(uploadSessions.id, session.id))
          .limit(1);

        if (latest?.status === "completed") {
          return NextResponse.json({
            success: true,
            sessionId: latest.id,
            videoId: latest.videoId,
            key: latest.objectKey,
            size: latest.fileSize,
            alreadyCompleted: true,
          });
        }

        return NextResponse.json(
          { error: "Upload session is not completable" },
          { status: 409 }
        );
      }

      try {
        const parts = await listAllParts(
          client,
          bucket,
          session.objectKey,
          session.r2UploadId
        );

        const verificationError = verifyListedParts(
          parts,
          session.fileSize,
          session.partSize,
          session.partCount
        );

        if (verificationError) {
          await touchSession(session.id, "uploading");

          return NextResponse.json(
            { error: verificationError },
            { status: 400 }
          );
        }

        await client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: session.objectKey,
            UploadId: session.r2UploadId,
            MultipartUpload: {
              Parts: parts.map((part) => ({
                PartNumber: part.partNumber,
                ETag: part.etag,
              })),
            },
          })
        );

        const object = await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: session.objectKey,
          })
        );

        if (object.ContentLength !== session.fileSize) {
          await markSessionFailed(session.id);
          throw new Error("Completed object size mismatch");
        }

        const now = new Date();

        await db
          .update(uploadSessions)
          .set({
            status: "completed",
            updatedAt: now,
            completedAt: now,
          })
          .where(eq(uploadSessions.id, session.id));

        return NextResponse.json({
          success: true,
          sessionId: session.id,
          videoId: session.videoId,
          key: session.objectKey,
          size: object.ContentLength,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "";

        // Idempotent completion: object already finalized.
        if (/NoSuchUpload|already completed|not found/i.test(message)) {
          try {
            const object = await client.send(
              new HeadObjectCommand({
                Bucket: bucket,
                Key: session.objectKey,
              })
            );

            if (object.ContentLength === session.fileSize) {
              const now = new Date();

              await db
                .update(uploadSessions)
                .set({
                  status: "completed",
                  updatedAt: now,
                  completedAt: now,
                })
                .where(eq(uploadSessions.id, session.id));

              return NextResponse.json({
                success: true,
                sessionId: session.id,
                videoId: session.videoId,
                key: session.objectKey,
                size: object.ContentLength,
                alreadyCompleted: true,
              });
            }
          } catch {
            // Fall through to failure handling.
          }
        }

        await markSessionFailed(session.id);
        throw error;
      }
    }

    if (body.action === "abort") {
      if (session.status === "aborted") {
        return NextResponse.json({ aborted: true });
      }

      if (session.status === "completed") {
        return NextResponse.json(
          { error: "Completed uploads cannot be aborted" },
          { status: 409 }
        );
      }

      try {
        await abortRemoteUpload(
          client,
          bucket,
          session.objectKey,
          session.r2UploadId
        );
      } catch (error) {
        console.error("AbortMultipartUpload failed:", error);
      }

      await db
        .update(uploadSessions)
        .set({
          status: "aborted",
          updatedAt: new Date(),
        })
        .where(eq(uploadSessions.id, session.id));

      return NextResponse.json({ aborted: true });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Multipart operation failed:", error);

    return NextResponse.json(
      { error: "Multipart operation failed" },
      { status: 500 }
    );
  }
}
