import { desc, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { items, pricePoints, type Item } from "../lib/db/schema";
import { formatMoney, hostnameOf } from "../lib/format";
import { sendPriceNotification } from "../lib/notify";
import { inspectUrl, ScrapeError } from "../lib/scrape";

export type CheckResult =
  | {
      ok: true;
      itemId: string;
      title: string;
      priceCents: number;
      currency: string;
      previousCents: number | null;
      availability: string | null;
      inserted: boolean;
    }
  | {
      ok: false;
      itemId: string;
      title: string;
      error: string;
    };

type CheckSource = "auto" | "hermes";

function autoTitle(item: Item, scrapedTitle: string | null): string {
  const current = item.title.trim();
  if (!current || current === item.site || current === hostnameOf(item.url)) {
    return scrapedTitle ?? current;
  }
  return current;
}

export async function recordPriceResult(input: {
  item: Item;
  priceCents: number;
  currency: string;
  availability: string | null;
  source: CheckSource;
  notify?: boolean;
  scrapedTitle?: string | null;
  scrapedImageUrl?: string | null;
}): Promise<CheckResult> {
  const { item, priceCents, source } = input;
  const lastPoint = db
    .select()
    .from(pricePoints)
    .where(eq(pricePoints.itemId, item.id))
    .orderBy(desc(pricePoints.createdAt))
    .limit(1)
    .get();

  const previousCents = lastPoint?.priceCents ?? item.currentPriceCents;
  const previousLow = item.lowestPriceCents ?? previousCents;
  const now = new Date();
  const lowestPriceCents =
    previousLow === null ? priceCents : Math.min(previousLow, priceCents);
  const shouldInsert =
    !lastPoint ||
    lastPoint.priceCents !== priceCents ||
    now.getTime() - lastPoint.createdAt.getTime() > 3_600_000;

  const nextTitle = autoTitle(item, input.scrapedTitle ?? null);
  const nextImage = item.imageUrl ?? input.scrapedImageUrl ?? null;
  const nextCurrency =
    item.currentPriceCents === null ? input.currency : item.currency;

  db.transaction((tx) => {
    if (shouldInsert) {
      tx.insert(pricePoints)
        .values({
          itemId: item.id,
          priceCents,
          currency: input.currency,
          availability: input.availability,
          source,
          createdAt: now,
        })
        .run();
    }

    tx.update(items)
      .set({
        currentPriceCents: priceCents,
        currency: nextCurrency,
        lowestPriceCents,
        title: nextTitle,
        imageUrl: nextImage,
        lastCheckedAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(items.id, item.id))
      .run();
  });

  const notificationsOn = input.notify !== false;
  if (notificationsOn) {
    const targetCents = item.targetPriceCents;
    const crossedTarget =
      targetCents !== null &&
      previousCents !== null &&
      previousCents > targetCents &&
      priceCents <= targetCents;

    const baseline = item.notifiedLowCents ?? previousLow;
    const isMeaningfulLow =
      previousLow !== null &&
      priceCents < previousLow &&
      baseline !== null &&
      priceCents <= Math.round(baseline * 0.97) &&
      (item.notifiedLowCents === null || priceCents < item.notifiedLowCents);

    if (crossedTarget || isMeaningfulLow) {
      const sent = await sendPriceNotification({
        title: nextTitle,
        priceCents,
        currency: input.currency,
        previousCents,
        targetCents,
        url: item.url,
        kind: crossedTarget ? "target" : "low",
      });

      if (sent) {
        db.update(items)
          .set({
            notifiedLowCents:
              item.notifiedLowCents === null
                ? priceCents
                : Math.min(item.notifiedLowCents, priceCents),
          })
          .where(eq(items.id, item.id))
          .run();
      }
    }
  }

  console.log(
    `[${source === "hermes" ? "hermes" : "check"}] ${nextTitle}: ${formatMoney(
      priceCents,
      input.currency,
    )}${shouldInsert ? "" : ", unchanged"}`,
  );

  return {
    ok: true,
    itemId: item.id,
    title: nextTitle,
    priceCents,
    currency: input.currency,
    previousCents,
    availability: input.availability,
    inserted: shouldInsert,
  };
}

export function recordCheckFailure(item: Item, message: string): CheckResult {
  const now = new Date();
  const safeMessage = message.slice(0, 500);

  db.update(items)
    .set({
      lastCheckedAt: now,
      lastError: safeMessage,
      updatedAt: now,
    })
    .where(eq(items.id, item.id))
    .run();

  console.error(`[check] ${item.title}: ${safeMessage}`);

  return {
    ok: false,
    itemId: item.id,
    title: item.title,
    error: safeMessage,
  };
}

export async function checkItemPrice(
  itemId: string,
  options: { notify?: boolean } = {},
): Promise<CheckResult> {
  const item = db.select().from(items).where(eq(items.id, itemId)).get();
  if (!item) {
    return {
      ok: false,
      itemId,
      title: "Unknown item",
      error: "Item not found.",
    };
  }

  try {
    const result = await inspectUrl(item.url, {
      priceSelector: item.priceSelector,
      titleSelector: item.titleSelector,
      imageSelector: item.imageSelector,
    });

    if (result.priceCents === null) {
      throw new ScrapeError(
        "No price was found on that page. Add a custom CSS price selector in the item settings.",
        "no_price",
      );
    }

    return await recordPriceResult({
      item,
      priceCents: result.priceCents,
      currency: result.currency,
      availability: result.availability,
      source: "auto",
      notify: options.notify,
      scrapedTitle: result.title,
      scrapedImageUrl: result.imageUrl,
    });
  } catch (error) {
    const message =
      error instanceof ScrapeError
        ? error.message
        : `Unexpected error: ${(error as Error).message}`;
    return recordCheckFailure(item, message);
  }
}
