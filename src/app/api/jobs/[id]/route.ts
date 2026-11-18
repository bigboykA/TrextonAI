
import { db } from "@/db";
import {
  processingJobs,
  processingOutbox,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Unavailable" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return Response.json(
      { error: "Invalid job ID" },
      { status: 400 }
    );
  }

  try {
    const [job] = await db
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
        eq(
          processingOutbox.processingJobId,
          processingJobs.id
        )
      )
      .where(eq(processingJobs.id, id))
      .limit(1);

    if (!job) {
      return Response.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const submissionStatus =
      job.status === "pending"
        ? job.publicationStatus === "published"
          ? "queued"
          : "awaiting_publication"
        : job.status;

    return Response.json({
      ...job,
      submissionStatus,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}
