const CURRENCY_CODES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "BRL",
  "INR",
  "MXN",
  "NZD",
  "TRY",
  "ZAR",
  "CNY",
  "HKD",
  "SGD",
  "KRW",
] as const;

const CODE_RE = new RegExp(`\\b(${CURRENCY_CODES.join("|")})\\b`, "i");

const SYMBOL_RULES: Array<[RegExp, string | null]> = [
  [/R\$/i, "BRL"],
  [/C\$/i, "CAD"],
  [/A\$/i, "AUD"],
  [/€/, "EUR"],
  [/£/, "GBP"],
  [/¥/, "JPY"],
  [/₹/, "INR"],
  [/₺/, "TRY"],
  [/zł/i, "PLN"],
  [/\bkr\.?\b/i, null],
  [/CHF/i, "CHF"],
  [/\$/, "USD"],
];

export function defaultCurrency() {
  return (process.env.DEFAULT_CURRENCY ?? "EUR").toUpperCase();
}

/** Pick a currency from a block of text, falling back to the hint or the app default. */
export function detectCurrency(
  text: string,
  hint?: string | null,
  fallback: string = defaultCurrency(),
): string {
  const code = text.match(CODE_RE)?.[1];
  if (code) return code.toUpperCase();

  for (const [re, currency] of SYMBOL_RULES) {
    if (re.test(text)) return (currency ?? hint ?? fallback).toUpperCase();
  }

  return (hint ?? fallback).toUpperCase();
}

function normalizeNumeric(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  let value: number;

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    const normalized = s.split(thousandsSep).join("").replace(decimalSep, ".");
    value = Number(normalized);
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? "." : ",";
    const parts = s.split(sep);

    if (parts.length > 2) {
      const last = parts[parts.length - 1] ?? "";
      if (last.length > 0 && last.length <= 2) {
        value = Number(parts.slice(0, -1).join("") + "." + last);
      } else {
        value = Number(parts.join(""));
      }
    } else {
      const [whole = "0", fraction = ""] = parts;
      if (fraction.length > 0 && fraction.length <= 2) {
        value = Number(`${whole || "0"}.${fraction}`);
      } else {
        value = Number(whole + fraction);
      }
    }
  } else {
    value = Number(s);
  }

  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) {
    return null;
  }

  return value;
}

function isPriceLike(fragment: string) {
  return (
    CODE_RE.test(fragment) ||
    SYMBOL_RULES.some(([re]) => re.test(fragment))
  );
}

/**
 * Turn a human price string into integer cents.
 * Handles "$1,299.00", "1.299,00 €", "£12.50", "1 234,56 kr", "R$ 99,90" and similar.
 */
export function parsePriceText(
  input: string,
  options: { currencyHint?: string | null; fallbackCurrency?: string } = {},
): { cents: number; currency: string } | null {
  const text = input.replace(/[\u00a0\u202f]/g, " ").trim();
  if (!text) return null;

  const matches = [
    ...text.matchAll(/-?\d[\d\s.,'’]*\d|-?\d/g),
  ].filter((match) => {
    const raw = match[0].replace(/[\s'’]/g, "").replace(/[.,]+$/, "");
    return /\d/.test(raw);
  });

  if (matches.length === 0) return null;

  const scored = matches
    .map((match) => {
      const index = match.index ?? 0;
      const end = index + match[0].length;
      const before = text.slice(Math.max(0, index - 8), index);
      const after = text.slice(end, end + 8);
      const raw = match[0].replace(/[\s'’]/g, "").replace(/[.,]+$/, "");

      let score = 0;
      if (isPriceLike(before) || isPriceLike(after)) score += 4;
      if (/[.,]\d{1,2}$/.test(raw)) score += 2;
      if (text.length <= 48) score += 2;
      if (index > 0 && /[A-Za-z]/.test(text[index - 1])) score -= 1;

      return { match, score, value: normalizeNumeric(raw) };
    })
    .filter((entry) => entry.value !== null)
    .sort((a, b) => b.score - a.score || (a.match.index ?? 0) - (b.match.index ?? 0));

  const winner = scored[0];
  if (!winner || winner.value === null) return null;

  const currency = detectCurrency(
    text,
    options.currencyHint,
    options.fallbackCurrency ?? defaultCurrency(),
  );

  return {
    cents: Math.round(winner.value * 100),
    currency,
  };
}

export function normalizeAvailability(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (value.includes("instock") || value.includes("in_stock")) return "in_stock";
  if (value.includes("outofstock") || value.includes("out_of_stock")) {
    return "out_of_stock";
  }
  if (value.includes("preorder") || value.includes("pre_order")) return "preorder";
  if (value.includes("backorder") || value.includes("back_order")) {
    return "backorder";
  }
  if (value.includes("limited")) return "limited";
  return null;
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  preorder: "Pre-order",
  backorder: "Backorder",
  limited: "Limited",
};
