import { eq } from "drizzle-orm";
import { requireApiAuth } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { items, pricePoints, type NewItem } from "@/lib/db/schema";
import { defaultCurrency } from "@/lib/parse-price";
import { normalizeUrl, hostnameOf } from "@/lib/format";
import { inspectUrl, ScrapeError, type ScrapeResult } from "@/lib/scrape";
import {
  createItemSchema,
  emptyToNull,
  firstIssue,
} from "@/lib/validation";

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const payload = parsed.data;
  let url: string;
  try {
    url = normalizeUrl(payload.url);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }

  const duplicate = db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.url, url))
    .get();
  if (duplicate) {
    return Response.json(
      {
        error: "This link is already on your list.",
        itemId: duplicate.id,
      },
      { status: 409 },
    );
  }

  let info: ScrapeResult | null = null;
  let warning: string | null = null;

  try {
    info = await inspectUrl(url, {
      priceSelector: payload.priceSelector,
      titleSelector: payload.titleSelector,
      imageSelector: payload.imageSelector,
    });
  } catch (error) {
    warning =
      error instanceof ScrapeError
        ? error.message
        : "The page could not be read automatically.";
    console.error("[create]", error);
  }

  if (info && info.priceCents === null) {
    warning =
      "No price could be read from that page. Add the item, then set a custom CSS price selector in its settings.";
  }

  const now = new Date();
  const site = hostnameOf(url);
  const title =
    emptyToNull(payload.title) ?? info?.title ?? site;
  const currency = (
    payload.currency ??
    info?.currency ??
    defaultCurrency()
  ).toUpperCase();
  const suppliedImage = emptyToNull(payload.imageUrl);
  const imageUrl =
    suppliedImage && /^https?:\/\//i.test(suppliedImage)
      ? suppliedImage
      : (info?.imageUrl ?? null);

  const newItem: NewItem = {
    id: crypto.randomUUID(),
    url,
    title,
    imageUrl,
    site,
    currency,
    currentPriceCents: info?.priceCents ?? null,
    targetPriceCents: payload.targetPriceCents ?? null,
    lowestPriceCents: info?.priceCents ?? null,
    notifiedLowCents: info?.priceCents ?? null,
    category: emptyToNull(payload.category),
    notes: emptyToNull(payload.notes),
    status: "watching",
    checkIntervalHours: payload.checkIntervalHours ?? 6,
    priceSelector: emptyToNull(payload.priceSelector),
    titleSelector: emptyToNull(payload.titleSelector),
    imageSelector: emptyToNull(payload.imageSelector),
    lastCheckedAt: now,
    lastError: info?.priceCents === null || !info ? warning : null,
    createdAt: now,
    updatedAt: now,
  };

  db.transaction((tx) => {
    tx.insert(items).values(newItem).run();
    if (info?.priceCents != null) {
      tx.insert(pricePoints)
        .values({
          itemId: newItem.id,
          priceCents: info.priceCents,
          currency: info.currency ?? currency,
          availability: info.availability,
          source: "auto",
          createdAt: now,
        })
        .run();
    }
  });

  const created = db.select().from(items).where(eq(items.id, newItem.id)).get();

  return Response.json({ item: created, warning }, { status: 201 });
}

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const rows = db.select().from(items).all();
  return Response.json({ items: rows });
}
