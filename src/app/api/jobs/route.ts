import {
  requestVideoProcessing,
  UploadIncompleteError,
  VideoNotFoundError,
} from "@/lib/processing-job-service";

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
      typeof body?.videoId === "string"
        ? body.videoId.trim()
        : "";

    if (!UUID_PATTERN.test(videoId)) {
      return Response.json(
        { error: "videoId must be a valid UUID" },
        { status: 400 }
      );
    }

    const processing = await requestVideoProcessing(videoId);

    return Response.json(
      {
        message: processing.created
          ? "Video processing request registered"
          : "Video processing is already registered",
        jobId: processing.jobId,
        videoId,
        jobStatus: processing.jobStatus,
        publicationStatus: processing.eventStatus,
        submissionStatus: processing.submissionStatus,
        existing: !processing.created,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof VideoNotFoundError) {
      return Response.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error instanceof UploadIncompleteError) {
      return Response.json(
        { error: error.message },
        { status: 409 }
      );
    }

    console.error("Failed to register processing job:", error);

    return Response.json(
      { error: "Failed to register processing job" },
      { status: 500 }
    );
  }
}
