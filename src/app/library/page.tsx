import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ClipsPanel } from "@/components/clips/clips-panel";
import { PageHeader } from "@/components/ui/page-header";

export default function LibraryPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Clips"
        title="A quieter way to find the good part."
        description="Every cut keeps its moment, its context, and a clear path out. Preview slowly. Keep only what earns it."
        action={
          <Link
            href="/processing"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none"
          >
            Find more moments
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />
      <ClipsPanel showHeader={false} />
    </div>
  );
}
