
import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { generatedClips } from "@/db/schema";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: Context
) {
  const { id: videoId } = await params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(videoId)) {
    return NextResponse.json(
      { error: "Invalid video ID" },
      { status: 400 }
    );
  }

  try {
    const clips = await db
      .select()
      .from(generatedClips)
      .where(eq(generatedClips.videoId, videoId))
      .orderBy(asc(generatedClips.rank));

    return NextResponse.json({
      videoId,
      count: clips.length,
      clips,
    });
  } catch (error) {
    console.error("Failed to retrieve clips:", error);

    return NextResponse.json(
      { error: "Failed to retrieve clips" },
      { status: 500 }
    );
  }
}
