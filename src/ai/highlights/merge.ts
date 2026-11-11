import type { HighlightCandidate } from "./types";

function combineDistinct(left: string, right: string): string {
  if (left === right) {
    return left;
  }

  return `${left}; ${right}`;
}

export function mergeHighlights(
  candidates: HighlightCandidate[]
): HighlightCandidate[] {
  const sortedCandidates = [...candidates].sort(
    (a, b) => a.start - b.start || a.end - b.end
  );

  const merged: HighlightCandidate[] = [];

  for (const candidate of sortedCandidates) {
    const previous = merged[merged.length - 1];

    if (!previous || candidate.start > previous.end) {
      merged.push({ ...candidate });
      continue;
    }

    previous.end = Math.max(previous.end, candidate.end);
    previous.score += candidate.score;
    previous.reason = combineDistinct(
      previous.reason,
      candidate.reason
    );
    previous.text = combineDistinct(
      previous.text,
      candidate.text
    );
  }

  return merged.sort(
    (a, b) => b.score - a.score || a.start - b.start
  );
}
