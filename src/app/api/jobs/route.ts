
import { videoQueue } from "@/lib/video-queue";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const videoId = body?.videoId;

    if (
      typeof videoId !== "string" ||
      videoId.trim() === ""
    ) {
      return Response.json(
        { error: "A valid videoId is required" },
        { status: 400 }
      );
    }

    const job = await videoQueue.add("analyze-video", {
      videoId,
    });

    return Response.json(
      {
        message: "Video processing job created",
        jobId: job.id,
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
