
import { db } from "@/db";
import {
  processingJobs,
  uploadSessions,
  videos,
} from "@/db/schema";
import { videoQueue } from "@/lib/video-queue";
import { and, eq, inArray } from "drizzle-orm";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Unavailable" },
      { status: 403 }
    );
  }

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
      .select({
        id: videos.id,
        storageKey: videos.storageKey,
      })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      return Response.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    if (video.storageKey.startsWith("originals/")) {
      const [completedUpload] = await db
        .select({ id: uploadSessions.id })
        .from(uploadSessions)
        .where(
          and(
            eq(uploadSessions.videoId, videoId),
            eq(
              uploadSessions.objectKey,
              video.storageKey
            ),
            eq(uploadSessions.status, "completed")
          )
        )
        .limit(1);

      if (!completedUpload) {
        return Response.json(
          { error: "Recording upload is not completed" },
          { status: 409 }
        );
      }
    }

    const [activeJob] = await db
      .select({ id: processingJobs.id })
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.videoId, videoId),
          inArray(processingJobs.status, [
            "pending",
            "processing",
          ])
        )
      )
      .limit(1);

    if (activeJob) {
      return Response.json(
        {
          message: "Video processing is already queued",
          jobId: activeJob.id,
          videoId,
          existing: true,
        },
        { status: 202 }
      );
    }

    let processingJob: { id: string };

    try {
      [processingJob] = await db
        .insert(processingJobs)
        .values({ videoId })
        .returning({ id: processingJobs.id });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";

      if (code !== "23505") {
        throw error;
      }

      const [racingJob] = await db
        .select({ id: processingJobs.id })
        .from(processingJobs)
        .where(
          and(
            eq(processingJobs.videoId, videoId),
            inArray(processingJobs.status, [
              "pending",
              "processing",
            ])
          )
        )
        .limit(1);

      if (!racingJob) {
        throw error;
      }

      return Response.json(
        {
          message: "Video processing is already queued",
          jobId: racingJob.id,
          videoId,
          existing: true,
        },
        { status: 202 }
      );
    }

    try {
      await videoQueue.add(
        "analyze-video",
        {
          videoId,
          jobId: processingJob.id,
        },
        {
          jobId: processingJob.id,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2_000,
          },
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
