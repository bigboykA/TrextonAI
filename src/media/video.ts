
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// this is a small wrapper around the two command line tools
/**
 * 
 * ffprobe --> reads information about the video.
 * ffmpeg --> creates a new clip from the video. 
 */
const execFileAsync = promisify(execFile);

type ProbeResult = {
  format?: {
    duration?: string;
    size?: string;
  };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
  }>;
};

export async function getVideoMetadata(filePath: string) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries",
      "format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate",
      "-of", "json",
      filePath,
    ],
    { maxBuffer: 1024 * 1024 }
  );

  const data = JSON.parse(stdout) as ProbeResult;

  const video = data.streams?.find(
    (stream) => stream.codec_type === "video"
  );

  if (!video) {
    throw new Error("No video stream found");
  }

  const [numerator, denominator] = (
    video.avg_frame_rate ?? "0/1"
  ).split("/").map(Number);

  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    sizeBytes: Number(data.format?.size ?? 0),
    width: video.width,
    height: video.height,
    codec: video.codec_name,
    fps: denominator ? numerator / denominator : 0,
  };
}

export async function extractClip(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  endSeconds: number
) {
  if (
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    startSeconds < 0 ||
    endSeconds <= startSeconds
  ) {
    throw new Error("Invalid clip timestamps");
  }

  const duration = endSeconds - startSeconds;

  await execFileAsync("ffmpeg", [
    "-y",
    "-ss", String(startSeconds),
    "-i", inputPath,
    "-t", String(duration),
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputPath,
  ], { maxBuffer: 1024 * 1024 });

  return outputPath;
}
