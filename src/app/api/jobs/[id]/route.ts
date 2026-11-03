
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, id))
      .limit(1);

    if (!job) {
      return Response.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return Response.json(job);
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}
