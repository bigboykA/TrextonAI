import { eq } from "drizzle-orm";
import { db } from "@/db";
import { generatedClips } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Unavailable" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "Invalid clip ID" }, { status: 400 });
  }

  const [clip] = await db
    .select({
      id: generatedClips.id,
      videoId: generatedClips.videoId,
      jobId: generatedClips.jobId,
      rank: generatedClips.rank,
      start: generatedClips.start,
      end: generatedClips.end,
      score: generatedClips.score,
      reason: generatedClips.reason,
      transcriptText: generatedClips.transcriptText,
      createdAt: generatedClips.createdAt,
    })
    .from(generatedClips)
    .where(eq(generatedClips.id, id))
    .limit(1);

  if (!clip) {
    return Response.json({ error: "Clip not found" }, { status: 404 });
  }

  return Response.json({ clip });
}
