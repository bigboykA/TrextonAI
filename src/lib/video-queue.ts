
import { Queue } from "bullmq";

export const QUEUE_NAME = "video-processing";

export const videoQueue = new Queue(QUEUE_NAME, {
  connection: {
    host: "localhost",
    port: 6379,
  },
});
