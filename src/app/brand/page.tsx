import type { Metadata } from "next";
import { Check } from "lucide-react";
import {
  BrandWordmark,
  LogoConcept,
} from "@/components/brand/brand-mark";

export const metadata: Metadata = {
  title: "Logo exploration",
  robots: { index: false, follow: false },
};

const concepts = [
  {
    id: "faceted" as const,
    number: "01",
    name: "Faceted monogram",
    description:
      "A dominant chamfered T with a quiet inset x. Cut shoulders and a tapered diamond stem create a crystal-like silhouette without enclosing it in a badge.",
    selected: true,
  },
  {
    id: "angular" as const,
    number: "02",
    name: "Angular emblem",
    description:
      "A complete cut-stone silhouette holds the T in negative space. It has the strongest app-icon presence and the most cinematic weight.",
    selected: false,
  },
  {
    id: "minimal" as const,
    number: "03",
    name: "Minimal premium monogram",
    description:
      "The same proportions reduced to one clean silhouette and a small x. It is the quietest direction and the clearest at favicon scale.",
    selected: false,
  },
];

const sizes = [16, 24, 40];

export default function BrandExplorationPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Internal study
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
            Trexton monogram
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Three angular Tx directions derived from faceted, cut geometry.
            Each is shown in monochrome across interface and favicon sizes.
          </p>
        </div>
        <BrandWordmark />
      </header>

      <div className="grid gap-5 xl:grid-cols-3">
        {concepts.map((concept) => (
          <article
            key={concept.id}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="grid min-h-64 grid-cols-2">
              <div className="flex items-center justify-center bg-[#f5f1e8] p-8 text-[#17645d] [--brand-mark-ink:#f5f1e8]">
                <LogoConcept
                  concept={concept.id}
                  className="size-24"
                  title={`${concept.name}, light background`}
                />
              </div>
              <div className="flex items-center justify-center bg-[#171a19] p-8 text-[#83cfc3] [--brand-mark-ink:#171a19]">
                <LogoConcept
                  concept={concept.id}
                  className="size-24"
                  title={`${concept.name}, dark background`}
                />
              </div>
            </div>
            <div className="border-t border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.68rem] text-muted-foreground">
                    {concept.number}
                  </p>
                  <h2 className="mt-1 font-semibold">{concept.name}</h2>
                </div>
                {concept.selected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[0.68rem] font-semibold text-primary">
                    <Check aria-hidden="true" className="size-3" />
                    Selected
                  </span>
                ) : null}
              </div>
              <p className="mt-3 min-h-15 text-sm leading-5 text-muted-foreground">
                {concept.description}
              </p>
              <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-border">
                {[
                  {
                    label: "Light",
                    className:
                      "bg-[#f5f1e8] text-[#17645d] [--brand-mark-ink:#f5f1e8]",
                  },
                  {
                    label: "Dark",
                    className:
                      "bg-[#171a19] text-[#83cfc3] [--brand-mark-ink:#171a19]",
                  },
                ].map((surface) => (
                  <div
                    key={surface.label}
                    className={`flex min-h-24 items-end justify-center gap-4 p-4 ${surface.className}`}
                  >
                    {sizes.map((size) => (
                      <div
                        key={size}
                        className="flex flex-col items-center gap-2"
                      >
                        <LogoConcept
                          concept={concept.id}
                          style={{ width: size, height: size }}
                        />
                        <span className="font-mono text-[0.56rem] opacity-55">
                          {size}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="grid overflow-hidden rounded-2xl border border-border sm:grid-cols-2">
        <div className="flex min-h-40 items-center justify-center bg-[#f5f1e8] p-8 text-[#17645d]">
          <BrandWordmark className="[--brand-mark-ink:#f5f1e8]" />
        </div>
        <div className="flex min-h-40 items-center justify-center bg-[#171a19] p-8 text-[#83cfc3]">
          <BrandWordmark className="[--brand-mark-ink:#171a19]" />
        </div>
      </section>
    </div>
  );
}
