
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { generatedClips } from "@/db/schema";
import { createR2DownloadUrl } from "@/lib/storage/r2";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

type Context = {
  params: Promise<{ id: string }>;
};

function localVideoStream(
  filePath: string,
  start: number,
  end: number
) {
  const source = createReadStream(filePath, { start, end });
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      source.on("data", (chunk: string | Buffer) => {
        if (closed) return;

        try {
          const bytes =
            typeof chunk === "string"
              ? Buffer.from(chunk)
              : chunk;
          controller.enqueue(bytes);
          if (
            controller.desiredSize !== null &&
            controller.desiredSize <= 0
          ) {
            source.pause();
          }
        } catch {
          closed = true;
          source.destroy();
        }
      });
      source.once("end", () => {
        if (closed) return;
        closed = true;
        controller.close();
      });
      source.once("error", (error) => {
        if (closed) return;
        closed = true;
        controller.error(error);
      });
    },
    pull() {
      source.resume();
    },
    cancel() {
      closed = true;
      source.destroy();
    },
  });
}

export async function GET(
  request: NextRequest,
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

  const download = request.nextUrl.searchParams.get("download") === "1";
  const downloadName = `trexton-highlight-${clip.rank}.mp4`;

  if (clip.storageKey.startsWith("clips/")) {
    try {
      const url = await createR2DownloadUrl(
        clip.storageKey,
        300,
        download ? downloadName : undefined
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
    const range = request.headers.get("range");
    const match = range?.match(/^bytes=(\d*)-(\d*)$/);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = Math.min(
      match?.[2] ? Number(match[2]) : stat.size - 1,
      stat.size - 1
    );

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= stat.size
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stat.size}`,
        },
      });
    }

    const contentLength = end - start + 1;

    return new NextResponse(
      localVideoStream(filePath, start, end),
      {
        status: range ? 206 : 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(contentLength),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, no-store",
          ...(range
            ? {
                "Content-Range": `bytes ${start}-${end}/${stat.size}`,
              }
            : {}),
          ...(download
            ? {
                "Content-Disposition": `attachment; filename="${downloadName}"`,
              }
            : {}),
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
