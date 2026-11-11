import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  items,
  pricePoints,
  type Item,
  type ItemStatus,
  type PricePoint,
} from "./db/schema";
import { computeStats, type ItemStats } from "./stats";

const HISTORY_DAYS = 180;

export type SortKey = "newest" | "price-asc" | "price-desc" | "drop" | "name";

export type DashboardFilters = {
  status: ItemStatus | "all";
  dealsOnly: boolean;
  q: string;
  category: string | null;
  sort: SortKey;
};

export type DashboardCard = {
  item: Item;
  stats: ItemStats;
};

export type DashboardData = {
  cards: DashboardCard[];
  categories: string[];
  counts: {
    all: number;
    watching: number;
    deals: number;
    paused: number;
    purchased: number;
    archived: number;
  };
  valueByCurrency: Array<{ currency: string; cents: number }>;
  lastCheckedAt: Date | null;
};

export function getDashboardData(filters: DashboardFilters): DashboardData {
  const allItems = db.select().from(items).orderBy(desc(items.createdAt)).all();
  const itemIds = allItems.map((item) => item.id);
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 86_400_000);

  const points =
    itemIds.length > 0
      ? db
          .select()
          .from(pricePoints)
          .where(
            and(
              inArray(pricePoints.itemId, itemIds),
              gte(pricePoints.createdAt, cutoff),
            ),
          )
          .orderBy(asc(pricePoints.createdAt))
          .all()
      : [];

  const pointsByItem = new Map<string, PricePoint[]>();
  for (const point of points) {
    const existing = pointsByItem.get(point.itemId);
    if (existing) {
      existing.push(point);
    } else {
      pointsByItem.set(point.itemId, [point]);
    }
  }

  const allCards: DashboardCard[] = allItems.map((item) => ({
    item,
    stats: computeStats(item, pointsByItem.get(item.id) ?? []),
  }));

  const counts = {
    all: allItems.length,
    watching: 0,
    deals: 0,
    paused: 0,
    purchased: 0,
    archived: 0,
  };

  for (const card of allCards) {
    if (card.item.status === "watching") {
      counts.watching += 1;
      if (card.stats.isDeal) counts.deals += 1;
    } else if (card.item.status === "paused") {
      counts.paused += 1;
    } else if (card.item.status === "purchased") {
      counts.purchased += 1;
    } else if (card.item.status === "archived") {
      counts.archived += 1;
    }
  }

  const categories = [
    ...new Set(
      allItems
        .map((item) => item.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const valueMap = new Map<string, number>();
  let lastCheckedAt: Date | null = null;
  for (const card of allCards) {
    if (card.item.status !== "watching") continue;
    if (card.stats.currentCents !== null) {
      valueMap.set(
        card.item.currency,
        (valueMap.get(card.item.currency) ?? 0) + card.stats.currentCents,
      );
    }
    if (
      card.item.lastCheckedAt &&
      (!lastCheckedAt || card.item.lastCheckedAt > lastCheckedAt)
    ) {
      lastCheckedAt = card.item.lastCheckedAt;
    }
  }

  const valueByCurrency = [...valueMap.entries()]
    .map(([currency, cents]) => ({ currency, cents }))
    .sort((a, b) => b.cents - a.cents);

  const query = filters.q.trim().toLowerCase();

  let cards = allCards.filter((card) => {
    if (filters.dealsOnly) {
      if (card.item.status !== "watching" || !card.stats.isDeal) return false;
    } else if (filters.status !== "all" && card.item.status !== filters.status) {
      return false;
    }

    if (
      filters.category &&
      (card.item.category ?? "").toLowerCase() !== filters.category.toLowerCase()
    ) {
      return false;
    }

    if (query) {
      const haystack = [
        card.item.title,
        card.item.site,
        card.item.category ?? "",
        card.item.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  cards = [...cards].sort((a, b) => {
    switch (filters.sort) {
      case "price-asc":
        return (
          (a.stats.currentCents ?? Number.POSITIVE_INFINITY) -
          (b.stats.currentCents ?? Number.POSITIVE_INFINITY)
        );
      case "price-desc":
        return (
          (b.stats.currentCents ?? Number.NEGATIVE_INFINITY) -
          (a.stats.currentCents ?? Number.NEGATIVE_INFINITY)
        );
      case "drop":
        return (
          (a.stats.changePct ?? Number.POSITIVE_INFINITY) -
          (b.stats.changePct ?? Number.POSITIVE_INFINITY)
        );
      case "name":
        return a.item.title.localeCompare(b.item.title);
      default:
        return b.item.createdAt.getTime() - a.item.createdAt.getTime();
    }
  });

  return {
    cards,
    categories,
    counts,
    valueByCurrency,
    lastCheckedAt,
  };
}

export function getItemDetail(id: string): {
  item: Item;
  points: PricePoint[];
  stats: ItemStats;
} | null {
  const item = db.select().from(items).where(eq(items.id, id)).get();
  if (!item) return null;

  const points = db
    .select()
    .from(pricePoints)
    .where(eq(pricePoints.itemId, id))
    .orderBy(asc(pricePoints.createdAt))
    .all();

  return {
    item,
    points,
    stats: computeStats(item, points),
  };
}

export function getCategories(): string[] {
  const rows = db.select({ category: items.category }).from(items).all();
  return [
    ...new Set(
      rows
        .map((row) => row.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}
