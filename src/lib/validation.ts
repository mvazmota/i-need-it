import { z } from "zod";
import { ITEM_STATUSES } from "./db/schema";

const selector = z.string().trim().max(400).nullable().optional();

export const inspectSchema = z.object({
  url: z.string().trim().min(3, "Paste a product link first."),
  priceSelector: selector,
  titleSelector: selector,
  imageSelector: selector,
});

export const createItemSchema = z.object({
  url: z.string().trim().min(3, "Paste a product link first."),
  title: z.string().trim().min(1).max(180).optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  targetPriceCents: z.number().int().positive().nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  checkIntervalHours: z.number().int().min(1).max(168).optional(),
  priceSelector: selector,
  titleSelector: selector,
  imageSelector: selector,
});

export const updateItemSchema = z.object({
  url: z.string().trim().min(3).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  targetPriceCents: z.number().int().positive().nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  checkIntervalHours: z.number().int().min(1).max(168).optional(),
  priceSelector: selector,
  titleSelector: selector,
  imageSelector: selector,
});

export const manualPointSchema = z.object({
  priceCents: z.number().int().positive(),
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request.";
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
