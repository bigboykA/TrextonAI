import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  generatedClips,
  processingJobs,
  processingOutbox,
  uploadSessions,
  videos,
} from "@/db/schema";
import { deriveSubmissionStatus } from "@/lib/processing-job-service";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Unavailable" }, { status: 403 });
  }

  try {
    const recordings = await db
      .select({
        id: videos.id,
        title: videos.title,
        createdAt: videos.createdAt,
      })
      .from(videos)
      .orderBy(desc(videos.createdAt));

    if (recordings.length === 0) {
      return Response.json({ recordings: [] });
    }

    const videoIds = recordings.map((recording) => recording.id);
    const [jobs, clipCounts, sourceSizes] = await Promise.all([
      db
        .select({
          id: processingJobs.id,
          videoId: processingJobs.videoId,
          status: processingJobs.status,
          errorMessage: processingJobs.errorMessage,
          createdAt: processingJobs.createdAt,
          completedAt: processingJobs.completedAt,
          publicationStatus: processingOutbox.status,
        })
        .from(processingJobs)
        .leftJoin(
          processingOutbox,
          eq(processingOutbox.processingJobId, processingJobs.id)
        )
        .where(inArray(processingJobs.videoId, videoIds))
        .orderBy(desc(processingJobs.createdAt)),
      db
        .select({
          videoId: generatedClips.videoId,
          count: sql<number>`count(*)`,
        })
        .from(generatedClips)
        .where(inArray(generatedClips.videoId, videoIds))
        .groupBy(generatedClips.videoId),
      db
        .select({
          videoId: uploadSessions.videoId,
          fileSize: uploadSessions.fileSize,
        })
        .from(uploadSessions)
        .where(inArray(uploadSessions.videoId, videoIds)),
    ]);

    const latestJobByVideo = new Map<
      string,
      (typeof jobs)[number]
    >();

    for (const job of jobs) {
      if (!latestJobByVideo.has(job.videoId)) {
        latestJobByVideo.set(job.videoId, job);
      }
    }

    const clipCountByVideo = new Map(
      clipCounts.map((item) => [item.videoId, Number(item.count)])
    );
    const sourceSizeByVideo = new Map(
      sourceSizes.map((item) => [item.videoId, item.fileSize])
    );

    return Response.json({
      recordings: recordings.map((recording) => {
        const job = latestJobByVideo.get(recording.id) ?? null;

        return {
          ...recording,
          duration: null,
          sourceSizeBytes: sourceSizeByVideo.get(recording.id) ?? null,
          clipCount: clipCountByVideo.get(recording.id) ?? 0,
          latestJob: job
            ? {
                ...job,
                submissionStatus: deriveSubmissionStatus(
                  job.status,
                  job.publicationStatus
                ),
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Failed to list videos:", error);
    return Response.json(
      { error: "Failed to list recordings" },
      { status: 500 }
    );
  }
}
