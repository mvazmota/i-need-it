import Link from "next/link";
import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";

type Counts = {
  all: number;
  watching: number;
  deals: number;
  paused: number;
  purchased: number;
  archived: number;
};

export function StatusTabs({
  status,
  dealsOnly,
  counts,
  q,
  category,
  sort,
}: {
  status: string;
  dealsOnly: boolean;
  counts: Counts;
  q: string;
  category: string | null;
  sort: string;
}) {
  function href(target: "deals" | "all" | "watching" | "paused" | "purchased" | "archived") {
    const params = new URLSearchParams();
    if (target === "deals") {
      params.set("view", "deals");
    } else if (target !== "watching") {
      params.set("status", target);
    }
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (sort && sort !== "newest") params.set("sort", sort);
    const search = params.toString();
    return search ? `/?${search}` : "/";
  }

  const tabs = [
    { key: "watching" as const, label: "Watching", count: counts.watching },
    { key: "deals" as const, label: "Deals", count: counts.deals },
    { key: "paused" as const, label: "Paused", count: counts.paused },
    { key: "purchased" as const, label: "Purchased", count: counts.purchased },
    { key: "archived" as const, label: "Archived", count: counts.archived },
    { key: "all" as const, label: "All", count: counts.all },
  ];

  return (
    <div className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 py-1">
      {tabs.map((tab) => {
        const active =
          tab.key === "deals" ? dealsOnly : !dealsOnly && status === tab.key;
        const isDeals = tab.key === "deals";

        return (
          <Link
            key={tab.key}
            href={href(tab.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition",
              active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-ink/5 hover:text-ink",
            )}
          >
            {isDeals ? (
              <Flame
                className={cn(
                  "size-3.5",
                  active ? "text-accent" : "text-accent/80",
                )}
                strokeWidth={2.1}
              />
            ) : null}
            {tab.label}
            <span
              className={cn(
                "tnum rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                active ? "bg-white/15 text-paper" : "bg-ink/5 text-muted",
              )}
            >
              {tab.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
