
import "dotenv/config";

import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs/promises";
import {extractAudio} from "../media/audio"
import { db } from "../db";
import { processingJobs, videos } from "../db/schema";
import {
  getVideoMetadata,
  extractClip,
} from "../media/video";
import { transcribeAudio } from "../ai/transcribe";





type VideoJob = {
  videoId: string;
  jobId: string;
};

const worker = new Worker<VideoJob>(
  "video-processing",

  async (job) => {
    const { videoId, jobId } = job.data;

    try {
      // 1. Update the job status.
      await db
        .update(processingJobs)
        .set({
          status: "processing",
          errorMessage: null,
          completedAt: null,
        })
        .where(eq(processingJobs.id, jobId));

      console.log(`Processing video: ${videoId}`);

      // 2. Retrieve the video from PostgreSQL.
      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      if (!video) {
        throw new Error("Video not found");
      }

      // 3. Resolve the local video file.
      // Restrict this prototype to safe MP4 filenames.
      const filename = video.storageKey;

      if (!/^[a-zA-Z0-9_-]+\.mp4$/i.test(filename)) {
        throw new Error("Invalid local video filename");
      }

      const inputPath = path.join(
        process.cwd(),
        "local-videos",
        filename
      );

      await fs.access(inputPath);

      // 4. Inspect video with FFprobe.
      const metadata = await getVideoMetadata(inputPath);

      console.log("Video metadata:", metadata);

      if (
        !Number.isFinite(metadata.durationSeconds) ||
        metadata.durationSeconds <= 1
      ) {
        throw new Error("Invalid video duration");
      }

      // 5. Choose a test clip.
      const start = Math.min(
        30,
        metadata.durationSeconds / 2
      );

      const end = Math.min(
        start + 15,
        metadata.durationSeconds
      );

      // 6. Create output directory.
      const outputDir = path.join(
        process.cwd(),
        "local-clips"
      );

      await fs.mkdir(outputDir, { recursive: true });

      const outputPath = path.join(
        outputDir,
        `${jobId}.mp4`
      );

      // 7. Extract the clip with FFmpeg.
      await extractClip(
        inputPath,
        outputPath,
        start,
        end
      );



      console.log(`Clip generated: ${outputPath}`);

      const audioDir = path.join(
        process.cwd(),
        "local-audio"
      );
      
      await fs.mkdir(audioDir, { recursive: true });
      
      const audioPath = path.join(audioDir, `${jobId}.wav`);
      
      await extractAudio(inputPath, audioPath);
      
      console.log(`Audio extracted: ${audioPath}`);


      const transcriptDir = path.join(
        process.cwd(),
        "local-transcripts"
      );

      await fs.mkdir(transcriptDir, { recursive: true });

      const transcriptPath = path.join(
        transcriptDir,
        `${jobId}.json`
      );

      console.log(`Starting transcription for job ${jobId}`);

      await transcribeAudio(audioPath, transcriptPath);

      console.log(`Transcript saved: ${transcriptPath}`);


      // 8. Update PostgreSQL.
      await db
        .update(processingJobs)
        .set({
          status: "completed",
          errorMessage: null,
          completedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId));

        return {
          videoId,
          outputPath,
          audioPath,
          transcriptPath,
          start,
          end,
          metadata,
        };

    } catch (error) {
      console.error(`Processing failed: ${videoId}`, error);

      try {
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
      } catch (dbError) {
        console.error("Failed to save job failure:", dbError);
      }

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

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

console.log("The Trexton AI video worker has started");
