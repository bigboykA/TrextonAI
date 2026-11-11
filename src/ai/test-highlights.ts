
import path from "node:path";
import { RuleBasedDetector } from "./highlights/rule-detector";
import { mergeHighlights } from "./highlights/merge";

async function main() {
  const transcriptPath = path.join(
    process.cwd(),
    "local-transcripts",
    "a123f600-8ac5-4de2-9b64-cc77bc26f74c.json"
  );

  const detector = new RuleBasedDetector();

  // Step 1: Detect potential highlights
  const candidates = await detector.detect(transcriptPath);

  // Step 2: Merge overlapping highlight windows
  const highlights = mergeHighlights(candidates);

  // Step 3: Display results
  console.log("Raw candidates:", candidates.length);
  console.log("Merged highlights:", highlights.length);

  console.log(JSON.stringify(highlights, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
