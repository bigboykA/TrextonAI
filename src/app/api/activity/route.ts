import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
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
    const [uploads, jobs] = await Promise.all([
      db
        .select({
          id: uploadSessions.id,
          videoId: uploadSessions.videoId,
          fileName: uploadSessions.fileName,
          fileSize: uploadSessions.fileSize,
          status: uploadSessions.status,
          createdAt: uploadSessions.createdAt,
          updatedAt: uploadSessions.updatedAt,
          completedAt: uploadSessions.completedAt,
        })
        .from(uploadSessions)
        .orderBy(desc(uploadSessions.updatedAt))
        .limit(100),
      db
        .select({
          id: processingJobs.id,
          videoId: processingJobs.videoId,
          videoTitle: videos.title,
          status: processingJobs.status,
          errorMessage: processingJobs.errorMessage,
          createdAt: processingJobs.createdAt,
          completedAt: processingJobs.completedAt,
          publicationStatus: processingOutbox.status,
        })
        .from(processingJobs)
        .innerJoin(videos, eq(videos.id, processingJobs.videoId))
        .leftJoin(
          processingOutbox,
          eq(processingOutbox.processingJobId, processingJobs.id)
        )
        .orderBy(desc(processingJobs.createdAt))
        .limit(100),
    ]);

    return Response.json({
      uploads,
      jobs: jobs.map((job) => ({
        ...job,
        submissionStatus: deriveSubmissionStatus(
          job.status,
          job.publicationStatus
        ),
      })),
    });
  } catch (error) {
    console.error("Failed to list activity:", error);
    return Response.json(
      { error: "Failed to list activity" },
      { status: 500 }
    );
  }
}
