import { formatMoney } from "./format";

export function notificationsEnabled(): boolean {
  return Boolean(process.env.NTFY_TOPIC);
}

export async function sendPriceNotification(input: {
  title: string;
  priceCents: number;
  currency: string;
  previousCents: number | null;
  targetCents: number | null;
  url: string;
  kind: "target" | "low";
}): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;

  const base = (process.env.NTFY_URL ?? "https://ntfy.sh").replace(/\/+$/, "");
  const endpoint = `${base}/${encodeURIComponent(topic)}`;
  const price = formatMoney(input.priceCents, input.currency);
  const previous =
    input.previousCents !== null
      ? formatMoney(input.previousCents, input.currency)
      : null;
  const target =
    input.targetCents !== null
      ? formatMoney(input.targetCents, input.currency)
      : null;

  const lines = [
    input.title,
    previous ? `${price} (was ${previous})` : price,
    target ? `Target: ${target}` : null,
    input.url,
  ].filter(Boolean);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const headers: Record<string, string> = {
      "X-Title": input.kind === "target" ? "ineedit: target hit" : "ineedit: new low",
      "X-Priority": input.kind === "target" ? "high" : "default",
      "X-Tags": input.kind === "target" ? "moneybag,tada" : "chart_with_downwards_trend",
      "X-Click": input.url,
      "Content-Type": "text/plain; charset=utf-8",
    };
    if (process.env.NTFY_TOKEN) {
      headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: lines.join("\n"),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `[notify] ntfy returned HTTP ${response.status}: ${await response.text()}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[notify] could not send notification: ${(error as Error).message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
