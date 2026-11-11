import Link from "next/link";
import { Flame, RefreshCw, Zap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { StatusTabs } from "@/components/status-tabs";
import { Toolbar } from "@/components/toolbar";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/db/schema";
import {
  formatMoneyRounded,
  relativeTime,
} from "@/lib/format";
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

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="card flex h-full flex-col justify-between p-3.5 sm:p-4">
      <span className="label text-[9px] sm:text-[10px]">{label}</span>
      <div
        className={`tnum mt-3 text-[19px] font-semibold leading-none tracking-[-0.04em] sm:text-[22px] ${
          accent ? "text-accent-dark" : ""
        }`}
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
          <div className="max-w-2xl">
            <p className="label flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent" />
              Your wishlist
            </p>
            <h1 className="mt-3 text-balance text-[clamp(2.25rem,4.6vw,3.7rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
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

          <div className="grid grid-cols-3 gap-2.5 lg:w-[430px]">
            <StatCard
              label="Watching"
              value={data.counts.watching}
              hint={`${data.counts.all} item${data.counts.all === 1 ? "" : "s"} total`}
            />
            <StatCard label="Current value" value={valueNode} hint="at today's prices" />
            <StatCard
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
              {data.cards.map((card) => (
                <ItemCard key={card.item.id} card={card} />
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
