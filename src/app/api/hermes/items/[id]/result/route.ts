import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { normalizeAvailability } from "@/lib/parse-price";
import { workerAuthError } from "@/lib/worker-auth";
import { recordCheckFailure, recordPriceResult } from "@/worker/check";

type RouteContext = { params: Promise<{ id: string }> };

const resultSchema = z
  .object({
    priceCents: z.number().int().positive().max(1_000_000_000).optional(),
    currency: z.string().trim().length(3).optional(),
    availability: z.string().trim().max(60).nullable().optional(),
    error: z.string().trim().max(500).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.priceCents !== undefined || Boolean(data.error), {
    message: "Provide priceCents or error.",
  });

export async function POST(request: Request, context: RouteContext) {
  const unauthorized = workerAuthError(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const item = db.select().from(items).where(eq(items.id, id)).get();
  if (!item) {
    return Response.json({ error: "Item not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid result." },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  if (payload.priceCents === undefined) {
    return Response.json(
      recordCheckFailure(item, payload.error ?? "Hermes could not read a price."),
    );
  }

  const currency = (payload.currency ?? item.currency).toUpperCase();
  const result = await recordPriceResult({
    item,
    priceCents: payload.priceCents,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : item.currency,
    availability: normalizeAvailability(payload.availability),
    source: "hermes",
  });

  return Response.json(result);
}
