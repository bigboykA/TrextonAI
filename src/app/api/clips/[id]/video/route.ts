
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { generatedClips } from "@/db/schema";
import fs from "node:fs/promises";
import path from "node:path";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: Context
) {
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
    const video = await fs.readFile(filePath);

    return new NextResponse(video, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Video file unavailable" },
      { status: 404 }
    );
  }
}
