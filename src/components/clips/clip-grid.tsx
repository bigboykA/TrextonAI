import type { GeneratedClip } from "@/lib/frontend-types";
import { FocusCards } from "@/components/ui/focus-cards";
import { ClipCard } from "./clip-card";

export function ClipGrid({
  clips,
  view = "grid",
}: {
  clips: GeneratedClip[];
  view?: "grid" | "list";
}) {
  return (
    <FocusCards
      className={
        view === "list"
          ? "grid-cols-1 md:grid-cols-1 xl:grid-cols-1"
          : undefined
      }
      items={clips.map((clip) => ({
        id: clip.id,
        content: <ClipCard clip={clip} view={view} />,
      }))}
    />
  );
}
