import { asc, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { items } from "../lib/db/schema";
import { checkItemPrice, type CheckResult } from "./check";

export type BatchSummary = {
  total: number;
  ok: number;
  failed: number;
  results: CheckResult[];
};

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function runChecks(
  options: { dueOnly?: boolean; concurrency?: number } = {},
): Promise<BatchSummary> {
  const dueOnly = options.dueOnly ?? true;
  const concurrency = Math.max(1, options.concurrency ?? 2);

  const candidates = db
    .select()
    .from(items)
    .where(eq(items.status, "watching"))
    .orderBy(asc(items.lastCheckedAt))
    .all();

  const queue = dueOnly
    ? candidates.filter((item) => {
        if (!item.lastCheckedAt) return true;
        const nextCheck =
          item.lastCheckedAt.getTime() + item.checkIntervalHours * 3_600_000;
        return nextCheck <= Date.now();
      })
    : candidates;

  if (queue.length === 0) {
    console.log(
      `[check] nothing due (${candidates.length} watching item${
        candidates.length === 1 ? "" : "s"
      })`,
    );
    return { total: 0, ok: 0, failed: 0, results: [] };
  }

  console.log(
    `[check] checking ${queue.length} item${queue.length === 1 ? "" : "s"} with concurrency ${concurrency}`,
  );

  const results: CheckResult[] = [];
  let cursor = 0;

  async function consume() {
    while (cursor < queue.length) {
      const item = queue[cursor];
      cursor += 1;
      results.push(await checkItemPrice(item.id));
      await sleep(900 + Math.random() * 1200);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, consume),
  );

  const ok = results.filter((result) => result.ok).length;
  const failed = results.length - ok;
  console.log(`[check] done: ${ok} ok, ${failed} failed`);

  return { total: results.length, ok, failed, results };
}
