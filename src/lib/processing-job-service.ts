import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  processingJobs,
  processingOutbox,
  uploadSessions,
  videos,
  type VideoProcessingRequestedPayload,
} from "@/db/schema";
import {
  getDevelopmentUploadUserId,
} from "@/lib/storage/register-upload";
import { validateR2ObjectKey } from "@/lib/storage/r2";
import type { UploadSession } from "@/lib/storage/upload-sessions";

const ACTIVE_JOB_STATUSES = [
  "pending",
  "processing",
] as const;

type Transaction =
  Parameters<Parameters<typeof db.transaction>[0]>[0];

type ProcessingRequest = {
  jobId: string;
  jobStatus:
    | "pending"
    | "processing"
    | "completed"
    | "failed";
  eventId: string | null;
  eventStatus: "pending" | "claimed" | "published" | null;
  submissionStatus:
    | "awaiting_publication"
    | "queued"
    | "processing"
    | "completed"
    | "failed";
  created: boolean;
};

export class VideoNotFoundError extends Error {}
export class UploadIncompleteError extends Error {}

function processingPayload(
  videoId: string,
  jobId: string
): VideoProcessingRequestedPayload {
  return { videoId, jobId };
}

function submissionStatus(
  jobStatus: ProcessingRequest["jobStatus"],
  eventStatus: ProcessingRequest["eventStatus"]
): ProcessingRequest["submissionStatus"] {
  if (
    jobStatus === "processing" ||
    jobStatus === "completed" ||
    jobStatus === "failed"
  ) {
    return jobStatus;
  }

  return eventStatus === "published"
    ? "queued"
    : "awaiting_publication";
}

async function ensureOutboxEvent(
  tx: Transaction,
  videoId: string,
  job: {
    id: string;
    status: ProcessingRequest["jobStatus"];
  }
) {
  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "processing"
  ) {
    const [existing] = await tx
      .select({
        id: processingOutbox.id,
        status: processingOutbox.status,
      })
      .from(processingOutbox)
      .where(
        eq(processingOutbox.processingJobId, job.id)
      )
      .limit(1);

    return {
      event: existing ?? null,
      created: false,
    };
  }

  const [created] = await tx
    .insert(processingOutbox)
    .values({
      processingJobId: job.id,
      payload: processingPayload(videoId, job.id),
    })
    .onConflictDoNothing({
      target: processingOutbox.processingJobId,
    })
    .returning({
      id: processingOutbox.id,
      status: processingOutbox.status,
    });

  if (created) {
    return {
      event: created,
      created: true,
    };
  }

  const [existing] = await tx
    .select({
      id: processingOutbox.id,
      status: processingOutbox.status,
    })
    .from(processingOutbox)
    .where(eq(processingOutbox.processingJobId, job.id))
    .limit(1);

  if (!existing) {
    throw new Error("Processing outbox event was not created");
  }

  return {
    event: existing,
    created: false,
  };
}

async function ensureProcessingRequest(
  tx: Transaction,
  videoId: string,
  preferredJobId?: string | null
): Promise<ProcessingRequest> {
  let job:
    | {
        id: string;
        status: ProcessingRequest["jobStatus"];
      }
    | undefined;
  let createdJob = false;

  if (preferredJobId) {
    [job] = await tx
      .select({
        id: processingJobs.id,
        status: processingJobs.status,
      })
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.id, preferredJobId),
          eq(processingJobs.videoId, videoId)
        )
      )
      .limit(1);

    if (!job) {
      throw new Error(
        "Upload session references a missing processing job"
      );
    }
  } else {
    [job] = await tx
      .select({
        id: processingJobs.id,
        status: processingJobs.status,
      })
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.videoId, videoId),
          inArray(
            processingJobs.status,
            ACTIVE_JOB_STATUSES
          )
        )
      )
      .limit(1);

    if (!job) {
      const [inserted] = await tx
        .insert(processingJobs)
        .values({
          videoId,
          status: "pending",
        })
        .onConflictDoNothing()
        .returning({
          id: processingJobs.id,
          status: processingJobs.status,
        });

      if (inserted) {
        job = inserted;
        createdJob = true;
      } else {
        [job] = await tx
          .select({
            id: processingJobs.id,
            status: processingJobs.status,
          })
          .from(processingJobs)
          .where(
            and(
              eq(processingJobs.videoId, videoId),
              inArray(
                processingJobs.status,
                ACTIVE_JOB_STATUSES
              )
            )
          )
          .limit(1);
      }
    }
  }

  if (!job) {
    throw new Error("Unable to create processing job");
  }

  const { event, created } = await ensureOutboxEvent(
    tx,
    videoId,
    job
  );

  return {
    jobId: job.id,
    jobStatus: job.status,
    eventId: event?.id ?? null,
    eventStatus: event?.status ?? null,
    submissionStatus: submissionStatus(
      job.status,
      event?.status ?? null
    ),
    created: createdJob || created,
  };
}

export async function requestVideoProcessing(videoId: string) {
  const result = await db.transaction(async (tx) => {
    const [video] = await tx
      .select({
        id: videos.id,
        storageKey: videos.storageKey,
      })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      throw new VideoNotFoundError("Video not found");
    }

    if (video.storageKey.startsWith("originals/")) {
      const [completedUpload] = await tx
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
        throw new UploadIncompleteError(
          "Recording upload is not completed"
        );
      }
    }

    return ensureProcessingRequest(tx, videoId);
  });

  if (result.eventId && result.created) {
    console.log(
      JSON.stringify({
        event: "outbox.created",
        eventId: result.eventId,
        processingJobId: result.jobId,
        videoId,
      })
    );
  }

  return result;
}

export async function completeUploadAndRequestProcessing(
  session: UploadSession
) {
  const userId =
    session.userId ?? (await getDevelopmentUploadUserId());
  const storageKey = validateR2ObjectKey(session.objectKey);
  const title =
    session.fileName.replace(/\.mp4$/i, "").trim() ||
    "Uploaded recording";

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, session.id))
      .for("update")
      .limit(1);

    if (!current) {
      throw new Error("Upload session no longer exists");
    }

    await tx
      .insert(videos)
      .values({
        id: current.videoId,
        userId,
        title,
        storageKey,
        status: "pending",
      })
      .onConflictDoNothing({ target: videos.id });

    const [video] = await tx
      .select({
        id: videos.id,
        userId: videos.userId,
        storageKey: videos.storageKey,
      })
      .from(videos)
      .where(eq(videos.id, current.videoId))
      .limit(1);

    if (
      !video ||
      video.userId !== userId ||
      video.storageKey !== storageKey
    ) {
      throw new Error(
        "Video registration conflicts with existing data"
      );
    }

    const processing = await ensureProcessingRequest(
      tx,
      current.videoId,
      current.processingJobId
    );
    const now = new Date();

    await tx
      .update(uploadSessions)
      .set({
        userId,
        processingJobId: processing.jobId,
        status: "completed",
        updatedAt: now,
        completedAt: current.completedAt ?? now,
      })
      .where(eq(uploadSessions.id, current.id));

    return {
      videoId: current.videoId,
      userId,
      storageKey,
      ...processing,
    };
  });

  if (result.eventId && result.created) {
    console.log(
      JSON.stringify({
        event: "outbox.created",
        eventId: result.eventId,
        processingJobId: result.jobId,
        videoId: result.videoId,
        source: "upload_completion",
      })
    );
  }

  return result;
}
