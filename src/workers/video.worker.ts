
import "dotenv/config";

import { Worker } from "bullmq";
import { eq, and } from "drizzle-orm";

import { db } from "../db";
import { processingJobs } from "../db/schema";
import { QUEUE_NAME } from "../lib/video-queue";

const worker = new Worker(
  QUEUE_NAME,

  async (job) => {
    const { videoId, jobId } = job.data;

    console.log(`Starting analysis for ${videoId}`);

    // 1. Mark the job as processing.
    await db
      .update(processingJobs)
      .set({
        status: "processing",
        errorMessage: null,
      })
      .where(
        and(
          eq(processingJobs.id, jobId),
          eq(processingJobs.status, "pending")
        )
      );

    try {
      // 2. Simulate video processing.
      await new Promise((resolve) =>
        setTimeout(resolve, 5000)
      );

      // 3. Mark the job as completed.
      await db
        .update(processingJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId));

      console.log(`Finished analysis for ${videoId}`);

      return { videoId, highlightsFound: 5 };

    } catch (error) {
      // 4. Persist processing failure.
      await db
        .update(processingJobs)
        .set({
          status: "failed",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown processing error",
          completedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId));

      throw error;
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

worker.on("failed", async (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);

  // Covers failures outside the processor's try/catch.
  if (!job?.data?.jobId) return;

  try {
    await db
      .update(processingJobs)
      .set({
        status: "failed",
        errorMessage: error.message,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(processingJobs.id, job.data.jobId),
          eq(processingJobs.status, "processing")
        )
      );
  } catch (dbError) {
    console.error("Failed to persist job failure:", dbError);
  }
});

worker.on("error", console.error);

console.log("Trexton AI worker is running...");
