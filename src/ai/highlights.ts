
import fs from "node:fs/promises";

type Segment = {
  start: number;
  end: number;
  text: string;
};

type Highlight = {
  start: number;
  end: number;
  score: number;
  reason: string;
  text: string;
};

const signals = [
  { phrase: "enemy down", score: 5, reason: "Elimination" },
  { phrase: "kill leader", score: 5, reason: "Achievement" },
  { phrase: "one squad left", score: 7, reason: "Final squad" },
  { phrase: "champions", score: 10, reason: "Potential victory" },
  { phrase: "cracked", score: 3, reason: "Combat" },
  { phrase: "getting shot", score: 2, reason: "Combat" },
];

export async function detectHighlights(
  transcriptPath: string
): Promise<Highlight[]> {
  const raw = await fs.readFile(transcriptPath, "utf-8");
  const data = JSON.parse(raw) as { segments: Segment[] };

  const highlights: Highlight[] = [];

  for (const segment of data.segments) {
    const text = segment.text.toLowerCase();

    for (const signal of signals) {
      if (text.includes(signal.phrase)) {
        highlights.push({
          start: Math.max(0, segment.start - 10),
          end: segment.end + 10,
          score: signal.score,
          reason: signal.reason,
          text: segment.text,
        });
      }
    }
  }

  return highlights.sort((a, b) => b.score - a.score);
}
