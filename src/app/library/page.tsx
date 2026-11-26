import { LibraryView } from "@/components/library/library-view";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;

  return (
    <LibraryView
      initialSection={
        view === "highlights" ? "highlights" : "recordings"
      }
    />
  );
}
