import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  ExternalLink,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { CheckButton } from "@/components/check-button";
import { ItemSettings } from "@/components/item-settings";
import { ManualPriceForm } from "@/components/manual-price-form";
import { PriceChart } from "@/components/price-chart";
import { ProductImage } from "@/components/product-image";
import { StatusPill } from "@/components/status-pill";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import {
  AVAILABILITY_LABELS,
} from "@/lib/parse-price";
import {
  formatDate,
  formatMoney,
  relativeTime,
} from "@/lib/format";
import { getCategories, getItemDetail } from "@/lib/queries";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = db
    .select({ title: items.title })
    .from(items)
    .where(eq(items.id, id))
    .get();
  return { title: item?.title ?? "Item not found" };
}

function intervalLabel(hours: number): string {
  if (hours === 24) return "Daily";
  if (hours === 48) return "Every 2 days";
  if (hours === 168) return "Weekly";
  if (hours < 24) return `Every ${hours} h`;
  return `Every ${Math.round(hours / 24)} days`;
}

function pointSourceLabel(source: string): string {
  if (source === "manual") return "Manual";
  if (source === "hermes") return "Hermes";
  return "Auto";
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[12px] font-medium text-ink-soft">
        {children}
      </dd>
    </div>
  );
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params;
  const detail = getItemDetail(id);
  if (!detail) notFound();

  const { item, points, stats } = detail;
  const current = stats.currentCents;
  const target = item.targetPriceCents;
  const gap = target !== null && current !== null ? current - target : null;
  const progress =
    target === null || current === null
      ? 0
      : current <= target
        ? 100
        : Math.max(4, Math.round((target / current) * 100));

  const history = points
    .map((point, index) => ({
      point,
      delta: index > 0 ? point.priceCents - points[index - 1].priceCents : null,
    }))
    .reverse()
    .slice(0, 30);

  const categories = getCategories();

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Back to wishlist
      </Link>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={item.status} />
          {item.category ? <span className="chip">{item.category}</span> : null}
          <span className="text-[11px] text-muted">{item.site}</span>
        </div>
        <h1 className="mt-3 max-w-4xl text-balance font-display text-[clamp(2rem,3.4vw,3rem)] font-normal leading-[1.02] tracking-[-0.012em]">
          {item.title}
        </h1>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-soft underline decoration-line-strong underline-offset-4 transition hover:text-ink hover:decoration-ink"
        >
          Visit the shop
          <ArrowUpRight className="size-3.5" strokeWidth={2} />
        </a>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,370px)_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <ProductImage
            src={item.imageUrl}
            alt={item.title}
            className="aspect-[4/3] w-full rounded-2xl border border-line lg:aspect-square"
            imageClassName="p-6"
          />

          <div className="card p-4">
            <dl className="space-y-3">
              <DetailRow label="Status">
                <StatusPill status={item.status} />
              </DetailRow>
              <DetailRow label="Shop">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-48 items-center gap-1 truncate text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                >
                  {item.site}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </DetailRow>
              <DetailRow label="Category">
                {item.category ?? <span className="text-muted">None</span>}
              </DetailRow>
              <DetailRow label="Checks">
                {intervalLabel(item.checkIntervalHours)}
              </DetailRow>
              <DetailRow label="Last check">
                <span title={formatDate(item.lastCheckedAt)}>
                  {relativeTime(item.lastCheckedAt)}
                </span>
              </DetailRow>
              <DetailRow label="Added">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3 text-muted" />
                  {formatDate(item.createdAt)}
                </span>
              </DetailRow>
              <DetailRow label="Currency">{item.currency}</DetailRow>
            </dl>

            {item.notes ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="label flex items-center gap-1.5">
                  <Tag className="size-3" />
                  Notes
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-ink-soft">
                  {item.notes}
                </p>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          {item.lastError ? (
            <div className="rounded-2xl border border-bad/20 bg-bad-soft p-4">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" strokeWidth={2} />
                <div>
                  <p className="text-[13px] font-semibold text-bad">
                    The last check failed {relativeTime(item.lastCheckedAt)}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-5 text-bad/85">
                    {item.lastError}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-bad/65">
                    Add a custom CSS selector below, retry the check, or record a
                    price manually.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <section className="card relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-24 -top-28 size-64 rounded-full bg-accent/[0.055] blur-3xl" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="label">Current price</p>
                  {stats.targetHit ? (
                    <span className="chip chip-good">Target hit</span>
                  ) : stats.isLowest ? (
                    <span className="chip chip-ink">Lowest ever</span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-end gap-2.5">
                  {current !== null ? (
                    <span className="tnum text-[46px] font-semibold leading-none tracking-[-0.055em]">
                      {formatMoney(current, item.currency)}
                    </span>
                  ) : (
                    <span className="font-display text-[2.15rem] font-normal leading-none tracking-[-0.01em]">
                      No price yet
                    </span>
                  )}
                  {stats.deltaCents !== null && stats.deltaCents !== 0 ? (
                    <span
                      className={cn(
                        "tnum mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        stats.deltaCents < 0
                          ? "bg-good-soft text-good"
                          : "bg-bad-soft text-bad",
                      )}
                    >
                      {stats.deltaCents < 0 ? "↓" : "↑"}{" "}
                      {formatMoney(Math.abs(stats.deltaCents), item.currency)}
                      {stats.changePct !== null
                        ? ` · ${Math.abs(stats.changePct).toFixed(1)}%`
                        : ""}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
                  <span>
                    30-day avg{" "}
                    <span className="tnum font-medium text-ink-soft">
                      {stats.avg30Cents !== null
                        ? formatMoney(stats.avg30Cents, item.currency)
                        : "—"}
                    </span>
                  </span>
                  <span>
                    Lowest{" "}
                    <span className="tnum font-medium text-good">
                      {stats.lowestCents !== null
                        ? formatMoney(stats.lowestCents, item.currency)
                        : "—"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3" />
                    {relativeTime(item.lastCheckedAt)}
                  </span>
                </div>
                {current === null ? (
                  <p className="mt-2 text-[11px] leading-5 text-muted">
                    The page did not expose a readable price. Add one manually or
                    set a CSS price selector below.
                  </p>
                ) : null}
              </div>

              <CheckButton itemId={item.id} variant="full" className="shrink-0" />
            </div>

            {target === null ? (
              <p className="mt-5 rounded-xl border border-dashed border-line-strong bg-paper/40 px-4 py-3 text-[11px] text-muted">
                No target set. Add one in the settings below and the item will be
                flagged when it gets there.
              </p>
            ) : current === null || gap === null ? (
              <p className="mt-5 rounded-xl border border-dashed border-line-strong bg-paper/40 px-4 py-3 text-[11px] text-muted">
                Target{" "}
                <span className="tnum font-semibold text-ink">
                  {formatMoney(target, item.currency)}
                </span>{" "}
                set. Add a price to see progress.
              </p>
            ) : (
              <div className="mt-5 rounded-xl border border-line bg-paper/60 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-muted">
                    Target{" "}
                    <span className="tnum font-semibold text-ink">
                      {formatMoney(target, item.currency)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tnum font-semibold",
                      gap <= 0 ? "text-good" : "text-ink-soft",
                    )}
                  >
                    {gap <= 0
                      ? `${formatMoney(Math.abs(gap), item.currency)} under target`
                      : `${formatMoney(gap, item.currency)} to go`}
                  </span>
                </div>
                <div className="relative mt-2 h-2">
                  <div className="h-full overflow-hidden rounded-full bg-line">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        gap <= 0 ? "bg-good" : "bg-accent",
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {progress > 0 ? (
                    <span
                      className={cn(
                        "absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-surface",
                        gap <= 0 ? "bg-good" : "bg-accent",
                      )}
                      style={{ left: `calc(${progress}% - 5px)` }}
                    />
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-line pt-5">
              <PriceChart
                points={points}
                currency={item.currency}
                targetCents={target}
                lowestCents={stats.lowestCents}
              />
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[1.55rem] font-normal leading-none tracking-[-0.01em]">Price history</h2>
              <span className="text-[11px] text-muted">
                {points.length} point{points.length === 1 ? "" : "s"}
                {points.length > 30 ? " · latest 30 shown" : ""}
              </span>
            </div>

            {history.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">
                No price recorded yet. Run a check or add a manual price.
              </p>
            ) : (
              <div className="mt-3">
                <div className="hidden grid-cols-[1.3fr_0.7fr_0.8fr_auto] gap-3 border-b border-line pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:grid">
                  <span>Date</span>
                  <span>Source</span>
                  <span>Availability</span>
                  <span className="text-right">Price</span>
                </div>
                {history.map(({ point, delta }) => (
                  <div
                    key={point.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line/70 py-2.5 text-[12px] transition last:border-0 hover:bg-paper/45 sm:grid-cols-[1.3fr_0.7fr_0.8fr_auto]"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-ink-soft">
                        {formatDate(point.createdAt)}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted sm:hidden">
                        {pointSourceLabel(point.source)}
                        {point.availability
                          ? ` · ${AVAILABILITY_LABELS[point.availability] ?? point.availability}`
                          : ""}
                      </span>
                    </div>
                    <span className="hidden sm:block">
                      <span
                        className={cn(
                          "chip text-[9px]",
                          point.source === "manual" && "chip-accent",
                          point.source === "hermes" && "chip-ink",
                        )}
                      >
                        {pointSourceLabel(point.source)}
                      </span>
                    </span>
                    <span className="hidden text-[11px] text-muted sm:block">
                      {point.availability
                        ? AVAILABILITY_LABELS[point.availability] ??
                          point.availability
                        : "—"}
                    </span>
                    <span className="tnum flex items-center justify-end gap-2 text-right font-semibold">
                      {delta !== null && delta !== 0 ? (
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            delta < 0 ? "text-good" : "text-bad",
                          )}
                        >
                          {delta < 0 ? "↓" : "↑"}{" "}
                          {formatMoney(Math.abs(delta), item.currency)}
                        </span>
                      ) : null}
                      {formatMoney(point.priceCents, point.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <ManualPriceForm itemId={item.id} currency={item.currency} />

          <div id="settings">
            <ItemSettings item={item} categories={categories} />
          </div>
        </div>
      </div>
    </div>
  );
}
