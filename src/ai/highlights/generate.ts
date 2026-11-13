
import path from "node:path";
import fs from "node:fs/promises";

import { RuleBasedDetector } from "./rule-detector";
import { mergeHighlights } from "./merge";
import { extractClip } from "../../media/video";

export async function generateHighlights(
  videoPath: string,
  transcriptPath: string,
  outputDir: string,
  videoDuration: number,
  limit = 3
) {
  const detector = new RuleBasedDetector();

  // Detect potential highlights
  const candidates = await detector.detect(transcriptPath);

  // Merge overlapping windows
  const merged = mergeHighlights(candidates);

  // Keep the highest-scoring valid candidates
  const highlights = merged
    .map((candidate) => ({
      ...candidate,
      start: Math.max(0, candidate.start),
      end: Math.min(videoDuration, candidate.end),
    }))
    .filter((candidate) => candidate.end > candidate.start)
    .slice(0, limit);

  await fs.mkdir(outputDir, { recursive: true });

  const clips = [];

  for (let i = 0; i < highlights.length; i++) {
    const highlight = highlights[i];

    const outputPath = path.join(
      outputDir,
      `highlight-${i + 1}.mp4`
    );

    await extractClip(
      videoPath,
      outputPath,
      highlight.start,
      highlight.end
    );

    clips.push({
      ...highlight,
      outputPath,
    });

    console.log(`Generated highlight: ${outputPath}`);
  }

  return clips;
}
