
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { generatedClips } from "@/db/schema";
import { createR2DownloadUrl } from "@/lib/storage/r2";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: Context
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Unavailable" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { error: "Invalid clip ID" },
      { status: 400 }
    );
  }

  const [clip] = await db
    .select()
    .from(generatedClips)
    .where(eq(generatedClips.id, id))
    .limit(1);

  if (!clip) {
    return NextResponse.json(
      { error: "Clip not found" },
      { status: 404 }
    );
  }

  if (clip.storageKey.startsWith("clips/")) {
    try {
      const url = await createR2DownloadUrl(
        clip.storageKey,
        300
      );

      return NextResponse.redirect(url, {
        status: 307,
        headers: {
          "Cache-Control": "private, no-store",
        },
      });
    } catch (error) {
      console.error("Unable to sign clip playback:", error);

      return NextResponse.json(
        { error: "Video file unavailable" },
        { status: 404 }
      );
    }
  }

  // Compatibility for clips generated before R2 integration.
  const rootDir = path.resolve(process.cwd(), "local-clips");
  const filePath = path.resolve(
    process.cwd(),
    clip.storageKey
  );

  // Prevent accessing files outside local-clips.
  if (!filePath.startsWith(rootDir + path.sep)) {
    return NextResponse.json(
      { error: "Invalid storage path" },
      { status: 400 }
    );
  }

  try {
    const stat = await fs.stat(filePath);
    const video = createReadStream(filePath);

    return new NextResponse(
      Readable.toWeb(video) as ReadableStream,
      {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(stat.size),
        "Cache-Control": "private, no-store",
      },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Video file unavailable" },
      { status: 404 }
    );
  }
}
