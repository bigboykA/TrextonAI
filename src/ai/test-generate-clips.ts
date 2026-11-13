
import path from "node:path";
import fs from "node:fs/promises";

import { RuleBasedDetector } from "./highlights/rule-detector";
import { mergeHighlights } from "./highlights/merge";

import {
  getVideoMetadata,
  extractClip,
} from "../media/video";

async function main() {
  const root = process.cwd();

  const videoPath = path.join(
    root,
    "local-videos",
    "apexLegends.mp4"
  );

  const transcriptPath = path.join(
    root,
    "local-transcripts",
    "a123f600-8ac5-4de2-9b64-cc77bc26f74c.json"
  );

  const outputDir = path.join(
    root,
    "local-clips",
    "highlights-test"
  );

  await fs.mkdir(outputDir, { recursive: true });

  // 1. Detect potential highlights
  const detector = new RuleBasedDetector();
  const candidates = await detector.detect(transcriptPath);

  // 2. Merge overlapping highlights
  const merged = mergeHighlights(candidates);

  // 3. Read video duration for timestamp validation
  const metadata = await getVideoMetadata(videoPath);
  const duration = metadata.durationSeconds;

  // 4. Choose up to three valid candidates
  const highlights = merged
    .map((candidate) => ({
      ...candidate,
      start: Math.max(0, candidate.start),
      end: Math.min(duration, candidate.end),
    }))
    .filter((candidate) => candidate.end > candidate.start)
    .slice(0, 3);

  // 5. Generate clips
  for (let i = 0; i < highlights.length; i++) {
    const highlight = highlights[i];

    const outputPath = path.join(
      outputDir,
      `highlight-${i + 1}.mp4`
    );

    console.log(
      `Generating clip ${i + 1}: ` +
      `${highlight.start}s - ${highlight.end}s`
    );

    await extractClip(
      videoPath,
      outputPath,
      highlight.start,
      highlight.end
    );

    console.log(`Saved: ${outputPath}`);
  }

  console.log("Dynamic clip generation completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
