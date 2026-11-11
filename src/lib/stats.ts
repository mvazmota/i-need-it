import type { Item, PricePoint } from "./db/schema";

export type ItemStats = {
  currentCents: number | null;
  previousCents: number | null;
  deltaCents: number | null;
  changePct: number | null;
  lowestCents: number | null;
  avg30Cents: number | null;
  vs30Pct: number | null;
  isLowest: boolean;
  targetHit: boolean;
  isDeal: boolean;
  points30: PricePoint[];
  lastCheckedAt: Date | null;
  lastPointAt: Date | null;
  hasError: boolean;
};

export function computeStats(
  item: Item,
  points: PricePoint[],
  now: Date = new Date(),
): ItemStats {
  const sorted = [...points].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const lastPoint = sorted.at(-1) ?? null;
  const previousPoint = sorted.at(-2) ?? null;
  const currentCents = lastPoint?.priceCents ?? item.currentPriceCents ?? null;
  const previousCents = previousPoint?.priceCents ?? null;

  const allPrices = sorted.map((point) => point.priceCents);
  if (item.lowestPriceCents !== null) allPrices.push(item.lowestPriceCents);
  const lowestCents = allPrices.length > 0 ? Math.min(...allPrices) : null;

  const cutoff = now.getTime() - 30 * 86_400_000;
  const points30 = sorted.filter((point) => point.createdAt.getTime() >= cutoff);
  const avg30Cents =
    points30.length > 0
      ? Math.round(
          points30.reduce((total, point) => total + point.priceCents, 0) /
            points30.length,
        )
      : null;

  const deltaCents =
    currentCents !== null && previousCents !== null
      ? currentCents - previousCents
      : null;
  const changePct =
    deltaCents !== null && previousCents
      ? (deltaCents / previousCents) * 100
      : null;
  const vs30Pct =
    currentCents !== null && avg30Cents
      ? ((currentCents - avg30Cents) / avg30Cents) * 100
      : null;

  const isLowest =
    currentCents !== null &&
    lowestCents !== null &&
    currentCents <= lowestCents &&
    sorted.length >= 2;
  const targetHit =
    currentCents !== null &&
    item.targetPriceCents !== null &&
    currentCents <= item.targetPriceCents;

  return {
    currentCents,
    previousCents,
    deltaCents,
    changePct,
    lowestCents,
    avg30Cents,
    vs30Pct,
    isLowest,
    targetHit: Boolean(targetHit),
    isDeal: Boolean(targetHit) || (isLowest && sorted.length >= 3),
    points30,
    lastCheckedAt: item.lastCheckedAt,
    lastPointAt: lastPoint?.createdAt ?? null,
    hasError: Boolean(item.lastError),
  };
}

export function downsample<T>(values: T[], maximum: number): T[] {
  if (values.length <= maximum) return values;
  const step = (values.length - 1) / (maximum - 1);
  const result: T[] = [];
  for (let index = 0; index < maximum; index += 1) {
    result.push(values[Math.round(index * step)]);
  }
  return result;
}
