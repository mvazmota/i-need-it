import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney, relativeTime } from "@/lib/format";
import type { DashboardCard } from "@/lib/queries";
import { CheckButton } from "./check-button";
import { ProductImage } from "./product-image";
import { Sparkline } from "./sparkline";
import { StatusPill } from "./status-pill";

export function ItemCard({ card }: { card: DashboardCard }) {
  const { item, stats } = card;
  const current = stats.currentCents;
  const delta = stats.deltaCents;
  const target = item.targetPriceCents;
  const gap = target !== null && current !== null ? current - target : null;
  const progress =
    target === null || current === null
      ? 0
      : current <= target
        ? 100
        : Math.max(4, Math.round((target / current) * 100));

  const badge =
    item.status !== "watching" ? (
      <StatusPill status={item.status} />
    ) : stats.targetHit ? (
      <span className="chip chip-good">Target hit</span>
    ) : stats.isLowest ? (
      <span className="chip chip-ink">Lowest ever</span>
    ) : null;

  return (
    <article className="card group flex h-full flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-34px_rgb(26_23_18/0.55)]">
      <div className="relative">
        <Link href={`/items/${item.id}`} aria-label={item.title}>
          <ProductImage
            src={item.imageUrl}
            alt={item.title}
            className="aspect-[4/3] w-full"
            imageClassName="p-4 transition duration-300 group-hover:scale-[1.025]"
          />
        </Link>
        {badge ? <div className="absolute left-3 top-3">{badge}</div> : null}
        {item.lastError ? (
          <div
            className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-bad-soft text-bad"
            title={item.lastError}
          >
            <TriangleAlert className="size-3.5" strokeWidth={2} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium text-muted">
            {item.site}
          </span>
          {item.category ? (
            <span className="shrink-0 text-[11px] text-muted/80">
              {item.category}
            </span>
          ) : null}
        </div>

        <Link
          href={`/items/${item.id}`}
          className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.012em] text-ink transition hover:text-accent-dark"
        >
          {item.title}
        </Link>

        <div className="mt-auto space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="tnum text-[27px] font-semibold leading-none tracking-[-0.045em]">
                {current !== null ? formatMoney(current, item.currency) : "—"}
              </div>
              <div className="mt-1.5 flex h-4 items-center">
                {current === null ? (
                  <span className="text-[11px] font-medium text-bad">
                    Price not found
                  </span>
                ) : delta === null ? (
                  <span className="text-[11px] text-muted">First price</span>
                ) : delta === 0 ? (
                  <span className="text-[11px] text-muted">No change</span>
                ) : (
                  <span
                    className={cn(
                      "tnum inline-flex items-center gap-0.5 text-[11px] font-semibold",
                      delta < 0 ? "text-good" : "text-bad",
                    )}
                  >
                    {delta < 0 ? (
                      <ArrowDownRight className="size-3.5" strokeWidth={2.2} />
                    ) : (
                      <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
                    )}
                    {formatMoney(Math.abs(delta), item.currency)}
                    <span className="font-normal text-muted">
                      {stats.changePct !== null
                        ? ` (${Math.abs(stats.changePct).toFixed(1)}%)`
                        : ""}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <Sparkline
              prices={stats.points30.map((point) => point.priceCents)}
              className="h-11 w-24 shrink-0"
            />
          </div>

          {target !== null && current !== null && gap !== null ? (
            <div>
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="text-muted">
                  Target {formatMoney(target, item.currency)}
                </span>
                <span
                  className={cn(
                    "tnum font-medium",
                    gap <= 0 ? "text-good" : "text-ink-soft",
                  )}
                >
                  {gap <= 0
                    ? `${formatMoney(Math.abs(gap), item.currency)} under`
                    : `${formatMoney(gap, item.currency)} to go`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    gap <= 0 ? "bg-good" : "bg-accent",
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[11px] text-muted">
              Checked {relativeTime(item.lastCheckedAt)}
            </span>
            <div className="flex items-center gap-0.5">
              <CheckButton itemId={item.id} />
              <Link
                href={`/items/${item.id}`}
                className="flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
                aria-label={`Open ${item.title}`}
              >
                <ExternalLink className="size-3.5" strokeWidth={1.9} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
