import Link from "next/link";
import { Plus } from "lucide-react";
import { ClipsPanel } from "@/components/clips/clips-panel";
import { PageHeader } from "@/components/ui/page-header";

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Library"
        title="Your clips"
        description="Review, search, and download generated highlights."
        action={
          <Link
            href="/processing"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform duration-[var(--motion-feedback)] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none sm:h-9"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            New activity
          </Link>
        }
      />
      <ClipsPanel showHeader={false} />
    </div>
  );
}
