import Link from "next/link";
import { BellRing, Link2, Plus, SearchX, Target } from "lucide-react";

export function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-ink/5 text-muted">
          <SearchX className="size-5" strokeWidth={1.7} />
        </div>
        <h2 className="mt-4 font-display text-[1.9rem] font-normal leading-tight tracking-[-0.01em]">
          Nothing matches those filters.
        </h2>
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
          Try a shorter search, another category, or the full list.
        </p>
        <Link href="/" className="btn-secondary mt-5 h-9 text-[13px]">
          Clear filters
        </Link>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col items-center px-6 py-14 text-center sm:py-16">
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-line bg-surface shadow-sm">
          <Link2 className="size-6 text-ink" strokeWidth={1.7} />
          <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-surface bg-accent" />
        </div>
        <h2 className="mt-5 font-display text-[2.1rem] font-normal leading-tight tracking-[-0.01em]">
          Start with something you want.
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          Paste a product link from any shop. ineedit reads the page, remembers
          the price, and keeps watching it on your schedule.
        </p>
        <Link href="/items/new" className="btn-primary mt-6">
          <Plus className="size-4" strokeWidth={2.2} />
          Add your first item
        </Link>

        <div className="mt-10 grid w-full max-w-2xl gap-2 border-t border-line pt-6 text-left sm:grid-cols-3">
          {[
            {
              icon: Link2,
              title: "Paste a link",
              copy: "Any product page with a visible price.",
            },
            {
              icon: Target,
              title: "Set a target",
              copy: "Know the price you are happy to pay.",
            },
            {
              icon: BellRing,
              title: "Let it watch",
              copy: "The worker checks on your Pi and records history.",
            },
          ].map((step, index) => (
            <div
              key={step.title}
              className="rounded-xl border border-line/80 bg-paper/60 p-4"
            >
              <div className="flex items-center gap-2">
                <step.icon className="size-4 text-accent" strokeWidth={1.9} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Step {index + 1}
                </span>
              </div>
              <p className="mt-2 text-[13px] font-semibold">{step.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted">{step.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
