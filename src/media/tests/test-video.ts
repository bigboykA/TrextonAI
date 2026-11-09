
import path from "node:path";
import fs from "node:fs/promises";

import {
  getVideoMetadata,
  extractClip,
} from "../video";

async function main() {
  const inputPath = path.join(
    process.cwd(),
    "local-videos",
    "apexLegends.mp4"
  );

  const outputDir = path.join(
    process.cwd(),
    "local-clips"
  );

  await fs.mkdir(outputDir, { recursive: true });

  const metadata = await getVideoMetadata(inputPath);

  console.log("Video metadata:", metadata);

  if (metadata.durationSeconds < 2) {
    throw new Error("Test video is too short");
  }

  const start = Math.min(30, metadata.durationSeconds / 2);
  const end = Math.min(
    start + 15,
    metadata.durationSeconds
  );

  const outputPath = path.join(
    outputDir,
    "test-highlight.mp4"
  );

  await extractClip(
    inputPath,
    outputPath,
    start,
    end
  );

  console.log("Clip created:", outputPath);
}

main().catch((error) => {
  console.error("Video processing failed:", error);
  process.exitCode = 1;
});
