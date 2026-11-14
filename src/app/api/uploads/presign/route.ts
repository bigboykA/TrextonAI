
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  getR2Client,
  getR2Bucket,
} from "@/lib/storage/r2";

export const runtime = "nodejs";

const MAX_SIZE = 100 * 1024 * 1024;

export async function POST(request: Request) {
  // Temporary local-development-only endpoint.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Unavailable" },
      { status: 403 }
    );
  }

  try {
    const { fileName, contentType, fileSize } =
      await request.json();

    if (
      typeof fileName !== "string" ||
      !fileName.toLowerCase().endsWith(".mp4") ||
      contentType !== "video/mp4" ||
      !Number.isSafeInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_SIZE
    ) {
      return NextResponse.json(
        { error: "Select an MP4 under 100 MB" },
        { status: 400 }
      );
    }

    const videoId = randomUUID();
    const key = `originals/${videoId}/source.mp4`;

    const command = new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      ContentType: "video/mp4",
    });

    const uploadUrl = await getSignedUrl(
      getR2Client(),
      command,
      { expiresIn: 300 }
    );

    return NextResponse.json({
      videoId,
      key,
      uploadUrl,
      method: "PUT",
      contentType: "video/mp4",
      expiresIn: 300,
    });
  } catch (error) {
    console.error("Presign failed:", error);

    return NextResponse.json(
      { error: "Unable to prepare upload" },
      { status: 500 }
    );
  }
}
