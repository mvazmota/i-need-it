import { eq } from "drizzle-orm";
import { requireApiAuth } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { items, pricePoints } from "@/lib/db/schema";
import { firstIssue, manualPointSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const unauthorized = await requireApiAuth();
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

  const parsed = manualPointSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const now = new Date();
  const priceCents = parsed.data.priceCents;
  const lowestPriceCents =
    item.lowestPriceCents === null
      ? priceCents
      : Math.min(item.lowestPriceCents, priceCents);

  db.transaction((tx) => {
    tx.insert(pricePoints)
      .values({
        itemId: id,
        priceCents,
        currency: item.currency,
        availability: null,
        source: "manual",
        createdAt: now,
      })
      .run();

    tx.update(items)
      .set({
        currentPriceCents: priceCents,
        lowestPriceCents,
        updatedAt: now,
      })
      .where(eq(items.id, id))
      .run();
  });

  return Response.json({ ok: true, priceCents });
}
