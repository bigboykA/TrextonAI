
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  ListPartsCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Bucket } from "@/lib/storage/r2";

export const runtime = "nodejs";

const PART_SIZE = 16 * 1024 * 1024;
const MAX_SIZE = 512 * 1024 * 1024; // Development limit

function uploadKey(videoId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(videoId)) {
    throw new Error("Invalid video ID");
  }
  return `originals/${videoId}/source.mp4`;
}

export async function POST(request: Request) {
  // Local development only. Authentication is required
  // before exposing this endpoint publicly.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Unavailable" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const client = getR2Client();
    const bucket = getR2Bucket();

    if (body.action === "init") {
      const { fileName, fileSize } = body;

      if (
        typeof fileName !== "string" ||
        !fileName.toLowerCase().endsWith(".mp4") ||
        !Number.isSafeInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > MAX_SIZE
      ) {
        return NextResponse.json(
          { error: "Select an MP4 under 512 MiB" },
          { status: 400 }
        );
      }

      const videoId = randomUUID();
      const key = uploadKey(videoId);

      const result = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          ContentType: "video/mp4",
        })
      );

      if (!result.UploadId) {
        throw new Error("R2 did not return an upload ID");
      }

      return NextResponse.json({
        videoId,
        uploadId: result.UploadId,
        key,
        partSize: PART_SIZE,
        partCount: Math.ceil(fileSize / PART_SIZE),
      });
    }

    const { videoId, uploadId } = body;

    if (
      typeof videoId !== "string" ||
      typeof uploadId !== "string" ||
      !uploadId
    ) {
      return NextResponse.json(
        { error: "Missing upload identifiers" },
        { status: 400 }
      );
    }

    let key: string;

    try {
      key = uploadKey(videoId);
    } catch {
      return NextResponse.json(
        { error: "Invalid video ID" },
        { status: 400 }
      );
    }

    if (body.action === "sign") {
      const partNumber = body.partNumber;

      if (
        !Number.isInteger(partNumber) ||
        partNumber < 1 ||
        partNumber > Math.ceil(MAX_SIZE / PART_SIZE)
      ) {
        return NextResponse.json(
          { error: "Invalid part number" },
          { status: 400 }
        );
      }

      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(client, command, {
        expiresIn: 900,
      });

      return NextResponse.json({ url, partNumber });
    }

    if (body.action === "complete") {
      const expectedSize = body.fileSize;

      if (
        !Number.isSafeInteger(expectedSize) ||
        expectedSize <= 0 ||
        expectedSize > MAX_SIZE
      ) {
        return NextResponse.json(
          { error: "Invalid file size" },
          { status: 400 }
        );
      }

      const result = await client.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        })
      );

      const parts = (result.Parts ?? [])
        .filter((p) => p.PartNumber && p.ETag)
        .sort((a, b) => a.PartNumber! - b.PartNumber!);

      const expectedCount = Math.ceil(
        expectedSize / PART_SIZE
      );

      if (parts.length !== expectedCount) {
        return NextResponse.json(
          { error: "Not all parts were uploaded" },
          { status: 400 }
        );
      }

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const expectedPartSize =
          i === parts.length - 1
            ? expectedSize - i * PART_SIZE
            : PART_SIZE;

        if (
          part.PartNumber !== i + 1 ||
          part.Size !== expectedPartSize
        ) {
          return NextResponse.json(
            { error: "Part order or size mismatch" },
            { status: 400 }
          );
        }
      }

      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((p) => ({
              PartNumber: p.PartNumber!,
              ETag: p.ETag!,
            })),
          },
        })
      );

      const object = await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      if (object.ContentLength !== expectedSize) {
        throw new Error("Completed object size mismatch");
      }

      return NextResponse.json({
        success: true,
        videoId,
        key,
        size: object.ContentLength,
      });
    }

    if (body.action === "abort") {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        })
      );

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

