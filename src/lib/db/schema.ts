import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ITEM_STATUSES = [
  "watching",
  "paused",
  "purchased",
  "archived",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    site: text("site").notNull().default(""),
    currency: text("currency").notNull().default("EUR"),
    currentPriceCents: integer("current_price_cents"),
    targetPriceCents: integer("target_price_cents"),
    lowestPriceCents: integer("lowest_price_cents"),
    notifiedLowCents: integer("notified_low_cents"),
    category: text("category"),
    notes: text("notes"),
    status: text("status", { enum: ITEM_STATUSES }).notNull().default("watching"),
    checkIntervalHours: integer("check_interval_hours").notNull().default(6),
    priceSelector: text("price_selector"),
    titleSelector: text("title_selector"),
    imageSelector: text("image_selector"),
    lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("items_status_idx").on(table.status),
    index("items_last_checked_idx").on(table.lastCheckedAt),
  ],
);

export const pricePoints = sqliteTable(
  "price_points",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull(),
    availability: text("availability"),
    source: text("source", { enum: ["auto", "manual"] })
      .notNull()
      .default("auto"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("price_points_item_created_idx").on(table.itemId, table.createdAt),
  ],
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type PricePoint = typeof pricePoints.$inferSelect;
export type NewPricePoint = typeof pricePoints.$inferInsert;
