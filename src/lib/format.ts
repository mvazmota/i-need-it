const LOCALE = "en-GB";

export function formatMoney(
  cents: number | null | undefined,
  currency: string = "EUR",
): string {
  if (cents === null || cents === undefined) return "—";
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatCompactMoney(
  cents: number,
  currency: string = "EUR",
): string {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(cents / 100);
  } catch {
    return `${Math.round(cents / 100)} ${currency}`;
  }
}

export function formatMoneyRounded(
  cents: number | null | undefined,
  currency: string = "EUR",
): string {
  if (cents === null || cents === undefined) return "—";
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${Math.round(cents / 100)} ${currency}`;
  }
}

/** Parse a user-entered amount such as "1.299,00", "1,299.00" or "99.90" into cents. */
export function parseAmountToCents(input: string): number | null {
  let value = input.replace(/[^\d.,-]/g, "").trim();
  if (!value) return null;

  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    value = value.replace(",", ".");
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}


export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatDate(date: Date | number | null | undefined): string {
  if (date === null || date === undefined) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatShortDate(date: Date | number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function relativeTime(date: Date | number | null | undefined): string {
  if (date === null || date === undefined) return "never";
  const timestamp = new Date(date).getTime();
  const diffSeconds = Math.round((Date.now() - timestamp) / 1000);

  if (diffSeconds < 45) return "just now";
  if (diffSeconds < 90) return "1 min ago";

  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;

  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

export function cleanPageTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s|·•-]+|[\s|·•-]+$/g, "")
    .slice(0, 180)
    .trim();
}

const TRACKING_PARAMS = new Set([
  "gclid",
  "fbclid",
  "msclkid",
  "igshid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("That does not look like a valid product link.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links are supported.");
  }
  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

export function statusLabel(status: string): string {
  switch (status) {
    case "watching":
      return "Watching";
    case "paused":
      return "Paused";
    case "purchased":
      return "Purchased";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}…`;
}
