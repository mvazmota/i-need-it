import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { workerAuthError } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = workerAuthError(request);
  if (unauthorized) return unauthorized;

  const forceAll = new URL(request.url).searchParams.get("all") === "1";
  const now = Date.now();

  const due = db
    .select()
    .from(items)
    .where(eq(items.status, "watching"))
    .all()
    .filter((item) => {
      if (forceAll || !item.lastCheckedAt) return true;
      return (
        item.lastCheckedAt.getTime() + item.checkIntervalHours * 3_600_000 <=
        now
      );
    })
    .sort(
      (a, b) =>
        (a.lastCheckedAt?.getTime() ?? 0) - (b.lastCheckedAt?.getTime() ?? 0),
    )
    .slice(0, 50)
    .map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      currency: item.currency,
      targetPriceCents: item.targetPriceCents,
      checkIntervalHours: item.checkIntervalHours,
      priceSelector: item.priceSelector,
      lastCheckedAt: item.lastCheckedAt?.toISOString() ?? null,
    }));

  return Response.json({ items: due });
}
