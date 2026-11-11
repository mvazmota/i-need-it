import Link from "next/link";
import { Eye, Flame, RefreshCw, Wallet, Zap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { StatusTabs } from "@/components/status-tabs";
import { Toolbar } from "@/components/toolbar";
import { cn } from "@/lib/cn";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/db/schema";
import { formatMoneyRounded, relativeTime } from "@/lib/format";
import { getDashboardData, type SortKey } from "@/lib/queries";

export const dynamic = "force-dynamic";

const SORT_KEYS: SortKey[] = [
  "newest",
  "price-asc",
  "price-desc",
  "drop",
  "name",
];

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function StatItem({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: React.ReactNode;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col px-3.5 py-4 sm:px-4">
      <span className="flex items-center gap-1.5 text-muted">
        <Icon
          className={cn("size-3.5 shrink-0", accent && "text-accent")}
          strokeWidth={1.8}
        />
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.13em]">
          {label}
        </span>
      </span>
      <div
        className={cn(
          "tnum mt-3 text-[20px] font-semibold leading-none tracking-[-0.04em] sm:text-[23px]",
          accent && "text-accent-dark",
        )}
      >
        {value}
      </div>
      <span className="mt-1.5 text-[10px] leading-4 text-muted">{hint}</span>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const rawStatus = first(params.status);
  const status: ItemStatus | "all" =
    rawStatus === "all" ||
    (rawStatus && (ITEM_STATUSES as readonly string[]).includes(rawStatus))
      ? (rawStatus as ItemStatus | "all")
      : "watching";

  const dealsOnly = first(params.view) === "deals";
  const q = first(params.q)?.trim() ?? "";
  const category = first(params.category)?.trim() || null;
  const rawSort = first(params.sort);
  const sort: SortKey =
    rawSort && SORT_KEYS.includes(rawSort as SortKey)
      ? (rawSort as SortKey)
      : "newest";

  const data = getDashboardData({
    status,
    dealsOnly,
    q,
    category,
    sort,
  });

  const hasAnyItems = data.counts.all > 0;
  const hasFilters = Boolean(q || category || dealsOnly || status !== "watching");

  const valueNode =
    data.valueByCurrency.length === 0 ? (
      "—"
    ) : (
      <span className="flex flex-col gap-0.5">
        {data.valueByCurrency.slice(0, 2).map((entry, index) => (
          <span
            key={entry.currency}
            className={index === 0 ? "" : "text-[13px] font-medium text-muted"}
          >
            {formatMoneyRounded(entry.cents, entry.currency)}
          </span>
        ))}
      </span>
    );

  return (
    <div>
      <section className="mb-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="rise-in max-w-2xl">
            <p className="label flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent" />
              Your wishlist
            </p>
            <h1 className="mt-3 text-balance font-display text-[clamp(2.7rem,5vw,4.35rem)] font-normal leading-[0.93] tracking-[-0.015em]">
              Buy it when it&apos;s worth it.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-ink-soft">
              Paste a product link from any shop. ineedit records the price and
              keeps an eye on it, so you can wait for the right moment without
              checking every day.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="size-3.5" strokeWidth={1.9} />
                Last check {relativeTime(data.lastCheckedAt)}
              </span>
              {data.counts.deals > 0 ? (
                <Link
                  href="/?view=deals"
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-2.5 py-1 font-medium text-accent-dark transition hover:border-accent/35"
                >
                  <Flame className="size-3.5" strokeWidth={2} />
                  {data.counts.deals} deal
                  {data.counts.deals === 1 ? "" : "s"} waiting
                </Link>
              ) : null}
            </div>
          </div>

          <div
            className="rise-in card grid w-full grid-cols-3 divide-x divide-line overflow-hidden lg:w-[450px]"
            style={{ animationDelay: "70ms" }}
          >
            <StatItem
              icon={Eye}
              label="Watching"
              value={data.counts.watching}
              hint={`${data.counts.all} item${data.counts.all === 1 ? "" : "s"} total`}
            />
            <StatItem
              icon={Wallet}
              label="Value"
              value={valueNode}
              hint="at today's prices"
            />
            <StatItem
              icon={Flame}
              label="Deals"
              value={data.counts.deals}
              hint="target or new low"
              accent
            />
          </div>
        </div>
      </section>

      {hasAnyItems ? (
        <>
          <div className="mb-5 space-y-3">
            <StatusTabs
              status={status}
              dealsOnly={dealsOnly}
              counts={data.counts}
              q={q}
              category={category}
              sort={sort}
            />
            <Toolbar
              q={q}
              sort={sort}
              category={category}
              categories={data.categories}
              status={status}
              dealsOnly={dealsOnly}
            />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] text-muted">
              {data.cards.length} item{data.cards.length === 1 ? "" : "s"}
              {dealsOnly ? " on deal" : ""}
            </p>
            {hasFilters ? (
              <Link
                href="/"
                className="text-[11px] font-medium text-ink-soft underline decoration-line-strong underline-offset-4 transition hover:text-ink"
              >
                Clear filters
              </Link>
            ) : null}
          </div>

          {data.cards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {data.cards.map((card, index) => (
                <div
                  key={card.item.id}
                  className="rise-in h-full"
                  style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                >
                  <ItemCard card={card} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState filtered />
          )}
        </>
      ) : (
        <EmptyState filtered={false} />
      )}

      {hasAnyItems && data.cards.length > 0 && data.counts.deals > 0 && !dealsOnly ? (
        <Link
          href="/?view=deals"
          className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-accent/20 bg-accent-soft/60 px-4 py-3.5 text-sm transition hover:border-accent/35"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-white">
              <Zap className="size-4" strokeWidth={2.1} />
            </span>
            <span>
              <span className="font-semibold text-accent-dark">
                {data.counts.deals} item
                {data.counts.deals === 1 ? " is" : "s are"} at a good price
              </span>
              <span className="ml-1.5 text-accent-dark/70">
                — target hit or lowest recorded.
              </span>
            </span>
          </span>
          <span className="hidden shrink-0 text-xs font-semibold text-accent-dark sm:block">
            See deals →
          </span>
        </Link>
      ) : null}
    </div>
  );
}
