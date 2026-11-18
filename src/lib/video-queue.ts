
import { Queue, type JobsOptions } from "bullmq";

export const QUEUE_NAME = "video-processing";

function redisAddress() {
  const url = new URL(
    process.env.REDIS_URL ?? "redis://localhost:6379"
  );

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export function getWorkerRedisConnection() {
  return {
    ...redisAddress(),
    maxRetriesPerRequest: null,
  };
}

export const videoQueue = new Queue(QUEUE_NAME, {
  connection: {
    ...redisAddress(),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
  },
});

export const VIDEO_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2_000,
  },
  removeOnComplete: {
    age: 7 * 24 * 60 * 60,
    count: 1_000,
  },
  removeOnFail: {
    age: 30 * 24 * 60 * 60,
    count: 5_000,
  },
} satisfies JobsOptions;

export async function publishVideoProcessingJob(
  videoId: string,
  jobId: string
) {
  return videoQueue.add(
    "analyze-video",
    { videoId, jobId },
    {
      ...VIDEO_JOB_OPTIONS,
      jobId,
    }
  );
}
