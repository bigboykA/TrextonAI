
import "dotenv/config";
import { Worker } from "bullmq";
import { QUEUE_NAME } from "../lib/video-queue";

const worker = new Worker(
  QUEUE_NAME,

  async (job) => {
    console.log(
      `Starting analysis for video ${job.data.videoId}`
    );

    // Simulate an expensive AI operation
    await new Promise((resolve) =>
      setTimeout(resolve, 5000)
    );

    console.log(
      `Finished analysis for video ${job.data.videoId}`
    );

    return {
      videoId: job.data.videoId,
      highlightsFound: 5,
    };
  },

  {
    connection: {
      host: "localhost",
      port: 6379,
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

console.log("Trexton AI worker is running...");
