
import { db } from "@/db";
import { processingJobs, videos } from "@/db/schema";
import { videoQueue } from "@/lib/video-queue";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const videoId =
      typeof body?.videoId === "string" ? body.videoId.trim() : "";

    if (!UUID_PATTERN.test(videoId)) {
      return Response.json(
        { error: "videoId must be a valid UUID" },
        { status: 400 }
      );
    }

    const [video] = await db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      return Response.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    const [processingJob] = await db
      .insert(processingJobs)
      .values({ videoId })
      .returning({ id: processingJobs.id });

    try {
      await videoQueue.add(
        "analyze-video",
        {
          videoId,
          jobId: processingJob.id,
        },
        {
          jobId: processingJob.id,
        }
      );
    } catch (queueError) {
      await db
        .update(processingJobs)
        .set({
          status: "failed",
          errorMessage: "Failed to enqueue video processing",
          completedAt: new Date(),
        })
        .where(eq(processingJobs.id, processingJob.id));

      throw queueError;
    }

    return Response.json(
      {
        message: "Video processing job created",
        jobId: processingJob.id,
        videoId,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Failed to create job:", error);

    return Response.json(
      { error: "Failed to create processing job" },
      { status: 500 }
    );
  }
}
