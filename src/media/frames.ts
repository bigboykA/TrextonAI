
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export async function extractFrames(
  inputPath: string,
  outputDir: string,
  intervalSeconds = 10
): Promise<string> {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error("Frame interval must be positive");
  }

  await fs.mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, "frame-%05d.jpg");

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-i", inputPath,
      "-vf", `fps=1/${intervalSeconds}`,
      "-q:v", "3",
      outputPattern,
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
      stderr = stderr.slice(-4096);
    });

    ffmpeg.on("error", reject);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(outputDir);
      } else {
        reject(new Error(`Frame extraction failed: ${stderr}`));
      }
    });
  });
}
