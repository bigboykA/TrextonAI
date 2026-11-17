import "dotenv/config";

import { UnrecoverableError, Worker } from "bullmq";
import { and, eq, notInArray } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { generateHighlights } from "../ai/highlights/generate";
import { transcribeAudio } from "../ai/transcribe";
import { db } from "../db";
import {
  generatedClips,
  processingJobs,
  uploadSessions,
  videos,
} from "../db/schema";
import {
  cleanupStaleProcessingWorkspaces,
  createProcessingWorkspace,
  removeProcessingWorkspace,
} from "../lib/processing-workspace";
import {
  downloadR2ObjectToFile,
  uploadFileToR2,
  validateR2ObjectKey,
} from "../lib/storage/r2";
import { QUEUE_NAME } from "../lib/video-queue";
import { extractAudio } from "../media/audio";
import { getVideoMetadata } from "../media/video";

type VideoJob = {
  videoId: string;
  jobId: string;
};

class PermanentProcessingError extends Error {}

function permanent(message: string): never {
  throw new PermanentProcessingError(message);
}

function isR2Source(storageKey: string) {
  return storageKey.startsWith("originals/");
}

async function stageSourceVideo(
  videoId: string,
  storageKey: string,
  destinationPath: string
) {
  if (isR2Source(storageKey)) {
    validateR2ObjectKey(storageKey);

    const [session] = await db
      .select({
        fileSize: uploadSessions.fileSize,
      })
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.videoId, videoId),
          eq(uploadSessions.objectKey, storageKey),
          eq(uploadSessions.status, "completed")
        )
      )
      .limit(1);

    if (!session) {
      permanent("Recording upload is not completed");
    }

    try {
      await downloadR2ObjectToFile(
        storageKey,
        destinationPath,
        session.fileSize
      );
    } catch (error) {
      const name =
        error && typeof error === "object" && "name" in error
          ? String(error.name)
          : "";

      if (/NoSuchKey|NotFound/i.test(name)) {
        permanent("Source recording is missing from R2");
      }

      throw error;
    }

    return "r2" as const;
  }

  // Compatibility: `local:filename.mp4` is explicit; bare
  // filenames remain supported for existing database rows.
  const filename = storageKey.startsWith("local:")
    ? storageKey.slice("local:".length)
    : storageKey;

  if (!/^[a-zA-Z0-9_-]+\.mp4$/i.test(filename)) {
    permanent("Invalid local video filename");
  }

  const legacyPath = path.join(
    process.cwd(),
    "local-videos",
    filename
  );

  try {
    await fs.copyFile(legacyPath, destinationPath);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      permanent("Legacy local recording is missing");
    }

    throw error;
  }

  return "local" as const;
}

function clipObjectKey(
  videoId: string,
  jobId: string,
  rank: number
) {
  return `clips/${videoId}/${jobId}/highlight-${rank}.mp4`;
}

void cleanupStaleProcessingWorkspaces().catch((error) => {
  console.warn("Stale workspace cleanup failed:", error);
});

const worker = new Worker<VideoJob>(
  QUEUE_NAME,
  async (job) => {
    const { videoId, jobId } = job.data;
    const workspace = await createProcessingWorkspace();

    try {
      await Promise.all([
        db
          .update(processingJobs)
          .set({
            status: "processing",
            errorMessage: null,
            completedAt: null,
          })
          .where(eq(processingJobs.id, jobId)),
        db
          .update(videos)
          .set({ status: "processing" })
          .where(eq(videos.id, videoId)),
      ]);

      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      if (!video) {
        permanent("Video not found");
      }

      const sourceType = await stageSourceVideo(
        videoId,
        video.storageKey,
        workspace.sourcePath
      );
      const metadata = await getVideoMetadata(
        workspace.sourcePath
      );

      if (
        !Number.isFinite(metadata.durationSeconds) ||
        metadata.durationSeconds <= 1
      ) {
        permanent("Invalid video duration");
      }

      await extractAudio(
        workspace.sourcePath,
        workspace.audioPath
      );
      await transcribeAudio(
        workspace.audioPath,
        workspace.transcriptPath
      );

      const clips = await generateHighlights(
        workspace.sourcePath,
        workspace.transcriptPath,
        workspace.clipsDir,
        metadata.durationSeconds,
        3
      );
      const clipRecords: Array<
        typeof generatedClips.$inferInsert
      > = [];

      for (let index = 0; index < clips.length; index++) {
        const clip = clips[index];
        const rank = index + 1;
        const storageKey = clipObjectKey(
          videoId,
          jobId,
          rank
        );

        await uploadFileToR2(
          storageKey,
          clip.outputPath,
          "video/mp4"
        );

        clipRecords.push({
          videoId,
          jobId,
          rank,
          start: clip.start,
          end: clip.end,
          score: clip.score,
          reason: clip.reason,
          transcriptText: clip.text,
          storageKey,
        });
      }

      await db.transaction(async (tx) => {
        for (const record of clipRecords) {
          await tx
            .insert(generatedClips)
            .values(record)
            .onConflictDoUpdate({
              target: [
                generatedClips.jobId,
                generatedClips.rank,
              ],
              set: {
                start: record.start,
                end: record.end,
                score: record.score,
                reason: record.reason,
                transcriptText: record.transcriptText,
                storageKey: record.storageKey,
              },
            });
        }

        if (clipRecords.length === 0) {
          await tx
            .delete(generatedClips)
            .where(eq(generatedClips.jobId, jobId));
        } else {
          await tx
            .delete(generatedClips)
            .where(
              and(
                eq(generatedClips.jobId, jobId),
                notInArray(
                  generatedClips.rank,
                  clipRecords.map((record) => record.rank)
                )
              )
            );
        }

        await tx
          .update(processingJobs)
          .set({
            status: "completed",
            errorMessage: null,
            completedAt: new Date(),
          })
          .where(eq(processingJobs.id, jobId));

        await tx
          .update(videos)
          .set({ status: "completed" })
          .where(eq(videos.id, videoId));
      });

      console.log(
        `Processed ${videoId} from ${sourceType}; uploaded ${clipRecords.length} clips`
      );

      return {
        videoId,
        jobId,
        sourceType,
        clipKeys: clipRecords.map(
          (record) => record.storageKey
        ),
        metadata,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown processing error";
      const attempts = job.opts.attempts ?? 1;
      const isPermanent =
        error instanceof PermanentProcessingError;
      const isFinalAttempt =
        isPermanent || job.attemptsMade + 1 >= attempts;

      console.error(
        `Processing attempt failed for ${videoId}:`,
        error
      );

      try {
        await Promise.all([
          db
            .update(processingJobs)
            .set({
              status: isFinalAttempt ? "failed" : "pending",
              errorMessage: message,
              completedAt: isFinalAttempt
                ? new Date()
                : null,
            })
            .where(eq(processingJobs.id, jobId)),
          db
            .update(videos)
            .set({
              status: isFinalAttempt ? "failed" : "pending",
            })
            .where(eq(videos.id, videoId)),
        ]);
      } catch (dbError) {
        console.error("Failed to save job failure:", dbError);
      }

      if (isPermanent) {
        throw new UnrecoverableError(message);
      }

      throw error;
    } finally {
      await removeProcessingWorkspace(workspace.root).catch(
        (error) => {
          console.warn("Workspace cleanup failed:", error);
        }
      );
    }
  },
  {
    connection: {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
    },
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

console.log("The Trexton AI video worker has started");
