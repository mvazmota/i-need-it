import { load, type CheerioAPI } from "cheerio";
import {
  cleanPageTitle,
  hostnameOf,
} from "./format";
import {
  defaultCurrency,
  detectCurrency,
  normalizeAvailability,
  parsePriceText,
} from "./parse-price";

const MAX_BYTES = 3_000_000;

export type ScrapeOptions = {
  priceSelector?: string | null;
  titleSelector?: string | null;
  imageSelector?: string | null;
};

export type ScrapeResult = {
  title: string | null;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
  availability: string | null;
  site: string;
  finalUrl: string;
  method: "selector" | "json-ld" | "meta" | "microdata" | "fallback" | "none";
};

export class ScrapeError extends Error {
  code: string;

  constructor(message: string, code = "scrape_failed") {
    super(message);
    this.name = "ScrapeError";
    this.code = code;
  }
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return true;
  }
  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return true;
  }
  const private172 = host.match(/^172\.(\d+)\./);
  if (private172) {
    const second = Number(private172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ScrapeError("That does not look like a valid link.", "invalid_url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScrapeError("Only http and https links can be checked.", "invalid_url");
  }
  if (isBlockedHost(url.hostname)) {
    throw new ScrapeError(
      "Local and private network addresses are not allowed.",
      "invalid_url",
    );
  }
  return url;
}

async function fetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
  const target = assertSafeUrl(rawUrl);
  const timeout = Number(process.env.SCRAPER_TIMEOUT_MS) || 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          process.env.SCRAPER_USER_AGENT ??
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9,pt;q=0.8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new ScrapeError(
        `The shop took longer than ${Math.round(timeout / 1000)} seconds to respond.`,
        "timeout",
      );
    }
    throw new ScrapeError(
      `Could not reach the shop: ${(error as Error).message}`,
      "network",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new ScrapeError(
        `The shop blocked the request (HTTP ${status}). Some sites only allow real browsers.`,
        "blocked",
      );
    }
    if (status === 404 || status === 410) {
      throw new ScrapeError(
        `The product page no longer exists (HTTP ${status}). Check the link.`,
        "not_found",
      );
    }
    if (status === 429) {
      throw new ScrapeError(
        "The shop is rate-limiting requests (HTTP 429). Try again later.",
        "rate_limited",
      );
    }
    throw new ScrapeError(`The shop returned HTTP ${status}.`, "http_error");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (
    !contentType.includes("html") &&
    !contentType.includes("xml") &&
    contentType !== ""
  ) {
    throw new ScrapeError(
      "That link did not return an HTML product page.",
      "not_html",
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BYTES) {
    throw new ScrapeError(
      "The page is too large to inspect safely.",
      "too_large",
    );
  }

  const html = (await response.text()).slice(0, MAX_BYTES);
  const finalUrl = response.url || target.toString();
  assertSafeUrl(finalUrl);

  return { html, finalUrl };
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walkJson(value: unknown, visit: (node: JsonObject) => void, depth = 0) {
  if (depth > 8) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => walkJson(entry, visit, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  visit(value);
  Object.values(value).forEach((entry) => {
    if (typeof entry === "object" && entry !== null) {
      walkJson(entry, visit, depth + 1);
    }
  });
}

function typeList(node: JsonObject): string[] {
  const raw = node["@type"];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return [raw];
  return [];
}

function offerList(node: JsonObject): JsonObject[] {
  const offers: JsonObject[] = [];
  const push = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(push);
    } else if (isObject(value)) {
      offers.push(value);
    }
  };

  push(node.offers);
  if (Array.isArray(node.hasVariant)) {
    node.hasVariant.forEach((variant) => {
      if (isObject(variant)) push(variant.offers);
    });
  }
  return offers;
}

function priceFromOffer(
  offer: JsonObject,
  pageCurrency: string | null,
): { cents: number; currency: string } | null {
  const rawValue = offer.price ?? offer.lowPrice ?? offer.highPrice;
  if (rawValue === undefined || rawValue === null) return null;

  const raw = isObject(rawValue)
    ? (rawValue.price ?? rawValue.value ?? rawValue.amount)
    : rawValue;
  if (raw === undefined || raw === null) return null;

  const currencyHint =
    (typeof offer.priceCurrency === "string" && offer.priceCurrency) ||
    (isObject(offer.priceSpecification) &&
      typeof offer.priceSpecification.priceCurrency === "string" &&
      offer.priceSpecification.priceCurrency) ||
    pageCurrency;

  return parsePriceText(String(raw), {
    currencyHint,
    fallbackCurrency: defaultCurrency(),
  });
}

function firstImage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstImage(entry);
      if (found) return found;
    }
    return null;
  }
  if (isObject(value)) {
    if (typeof value.url === "string") return value.url;
    if (typeof value.contentUrl === "string") return value.contentUrl;
  }
  return null;
}

function resolveImage(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null;
  const value = raw.trim().split(/\s+/)[0];
  if (!value || value.startsWith("data:")) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    // Many shops (especially Shopify) expose a tiny thumbnail in structured
    // data. Ask for a larger render of the same image when the URL allows it.
    for (const key of ["width", "w", "height", "h"]) {
      const current = Number(url.searchParams.get(key));
      if (Number.isFinite(current) && current > 0 && current < 600) {
        url.searchParams.set(key, String(key === "w" || key === "h" ? 800 : 1200));
      }
    }

    return url.toString();
  } catch {
    return null;
  }
}

function metaContent($: CheerioAPI, selectors: string): string | null {
  for (const selector of selectors.split(",")) {
    const value = $(selector.trim()).first().attr("content");
    if (value) return value.trim();
  }
  return null;
}

type ParsedPrice = { cents: number; currency: string } | null;

function extractFromJsonLd(
  $: CheerioAPI,
  pageCurrency: string | null,
): {
  title: string | null;
  price: ParsedPrice;
  image: string | null;
  availability: string | null;
} {
  const documents: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const text = $(element)
      .text()
      .trim()
      .replace(/^\/\*?\s*<!\[CDATA\[\s*\*?\//, "")
      .replace(/\/\*?\s*\]\]>\s*\*?\/$/, "")
      .replace(/;\s*$/, "");
    if (!text) return;
    try {
      documents.push(JSON.parse(text));
    } catch {
      // A single malformed block should not stop the other blocks.
    }
  });

  const candidates: Array<{
    title: string | null;
    price: ParsedPrice;
    image: string | null;
    availability: string | null;
    score: number;
  }> = [];

  const visit = (node: JsonObject) => {
    const types = typeList(node);
    const looksLikeProduct =
      types.some((type) => /product/i.test(type)) ||
      (node.offers !== undefined &&
        (node.name !== undefined || node.image !== undefined));

    if (!looksLikeProduct) return;

    const offers = offerList(node);
    let price: ParsedPrice = null;
    let availability: string | null = null;

    for (const offer of offers) {
      const parsed = priceFromOffer(offer, pageCurrency);
      if (parsed) {
        price = parsed;
        availability =
          normalizeAvailability(
            typeof offer.availability === "string" ? offer.availability : null,
          ) ?? availability;
        break;
      }
    }

    if (!price && offers.length === 0) return;

    const title =
      typeof node.name === "string"
        ? cleanPageTitle(node.name)
        : typeof node.model === "string"
          ? cleanPageTitle(node.model)
          : null;
    const image = firstImage(node.image) ?? firstImage(node.thumbnailUrl);
    const score =
      (price ? 4 : 0) +
      (title ? 2 : 0) +
      (image ? 1 : 0) +
      (types.some((type) => /^product$/i.test(type)) ? 2 : 0);

    candidates.push({ title, price, image, availability, score });
  };

  for (const document of documents) {
    walkJson(document, visit);
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    title: candidates[0]?.title ?? null,
    price: candidates[0]?.price ?? null,
    image: candidates[0]?.image ?? null,
    availability: candidates[0]?.availability ?? null,
  };
}

function extractFromMeta(
  $: CheerioAPI,
  pageCurrency: string | null,
): { price: ParsedPrice; availability: string | null } {
  const raw =
    metaContent(
      $,
      [
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        'meta[itemprop="price"]',
        'meta[name="price"]',
        'meta[property="product:sale_price:amount"]',
      ].join(","),
    ) ?? null;

  const availabilityRaw =
    metaContent(
      $,
      [
        'meta[property="product:availability"]',
        'meta[itemprop="availability"]',
      ].join(","),
    ) ?? null;

  return {
    price: raw
      ? parsePriceText(raw, {
          currencyHint: pageCurrency,
          fallbackCurrency: defaultCurrency(),
        })
      : null,
    availability: normalizeAvailability(availabilityRaw),
  };
}

function extractFromMicrodata(
  $: CheerioAPI,
  pageCurrency: string | null,
): { price: ParsedPrice; availability: string | null } {
  const priceElement = $('[itemprop="price"]').first();
  const raw =
    priceElement.attr("content") ??
    priceElement.attr("data-price") ??
    priceElement.text().trim();
  const availabilityRaw = $('[itemprop="availability"]').first().attr("href") ??
    $('[itemprop="availability"]').first().attr("content");

  return {
    price: raw
      ? parsePriceText(raw, {
          currencyHint: pageCurrency,
          fallbackCurrency: defaultCurrency(),
        })
      : null,
    availability: normalizeAvailability(availabilityRaw),
  };
}

const FALLBACK_PRICE_SELECTORS = [
  '[data-price]',
  '[data-testid*="price"]',
  ".product-price .amount",
  ".product-price",
  ".price .amount",
  ".price",
  '[class*="price"]',
  '[id*="price"]',
];

function extractFromFallback(
  $: CheerioAPI,
  pageCurrency: string | null,
): ParsedPrice {
  for (const selector of FALLBACK_PRICE_SELECTORS) {
    const elements = $(selector).slice(0, 12);

    for (let index = 0; index < elements.length; index += 1) {
      const element = elements.eq(index);
      if (element.closest("del, s, [class*='old'], [class*='was']").length > 0) {
        continue;
      }

      const text =
        element.attr("data-price") ??
        element.attr("content") ??
        element.text().replace(/\s+/g, " ").trim();
      if (!text || text.length > 160) continue;
      if (!/\d/.test(text)) continue;
      if (!/[€£$¥₹₺]|\b(USD|EUR|GBP|BRL|CHF|SEK|NOK|DKK|PLN|CAD|AUD)\b/i.test(text)) {
        if (text.length > 28) continue;
      }

      const parsed = parsePriceText(text, {
        currencyHint: pageCurrency,
        fallbackCurrency: defaultCurrency(),
      });
      if (parsed) return parsed;
    }
  }

  return null;
}

function customSelectorError(selector: string, label: string) {
  return new ScrapeError(
    `The custom ${label} selector "${selector}" did not match anything on the page.`,
    "selector_miss",
  );
}

export async function inspectUrl(
  rawUrl: string,
  options: ScrapeOptions = {},
): Promise<ScrapeResult> {
  const { html, finalUrl } = await fetchHtml(rawUrl);
  const $ = load(html);

  const pageCurrency =
    metaContent(
      $,
      [
        'meta[property="product:price:currency"]',
        'meta[property="og:price:currency"]',
        'meta[itemprop="priceCurrency"]',
        'meta[name="priceCurrency"]',
      ].join(","),
    ) ?? null;

  const jsonLd = extractFromJsonLd($, pageCurrency);
  const meta = extractFromMeta($, pageCurrency);
  const microdata = extractFromMicrodata($, pageCurrency);

  let method: ScrapeResult["method"] = "none";
  let title: string | null = null;
  let price: { cents: number; currency: string } | null = null;
  let image: string | null = null;
  let availability: string | null = null;

  if (options.titleSelector) {
    const element = $(options.titleSelector).first();
    if (element.length === 0) {
      throw customSelectorError(options.titleSelector, "title");
    }
    title =
      cleanPageTitle(element.attr("content") ?? element.text()) || null;
    method = "selector";
  }

  const titleFromPage =
    jsonLd.title ||
    metaContent($, 'meta[property="og:title"],meta[name="twitter:title"]') ||
    cleanPageTitle($("h1").first().text()) ||
    cleanPageTitle($("title").first().text());

  title ??= titleFromPage || null;

  if (options.priceSelector) {
    const element = $(options.priceSelector).first();
    if (element.length === 0) {
      throw customSelectorError(options.priceSelector, "price");
    }
    const raw =
      element.attr("content") ??
      element.attr("data-price") ??
      element.text().replace(/\s+/g, " ").trim();
    const parsed = parsePriceText(raw, {
      currencyHint:
        element.attr("data-currency") ??
        metaContent(
          $,
          'meta[property="product:price:currency"],meta[property="og:price:currency"]',
        ),
      fallbackCurrency: defaultCurrency(),
    });
    if (!parsed) {
      throw new ScrapeError(
        `The custom price selector matched "${element.text().trim().slice(0, 60)}", but no price could be read from it.`,
        "selector_unreadable",
      );
    }
    price = parsed;
    method = "selector";
  }

  if (options.imageSelector) {
    const element = $(options.imageSelector).first();
    if (element.length === 0) {
      throw customSelectorError(options.imageSelector, "image");
    }
    image =
      resolveImage(
        element.attr("src") ??
          element.attr("content") ??
          element.attr("data-src") ??
          element.attr("data-srcset") ??
          element.attr("srcset"),
        finalUrl,
      ) ?? null;
    if (method === "none") method = "selector";
  }

  if (!price && jsonLd.price) {
    price = jsonLd.price;
    method = "json-ld";
  }
  if (!price && meta.price) {
    price = meta.price;
    method = "meta";
  }
  if (!price && microdata.price) {
    price = microdata.price;
    method = "microdata";
  }
  if (!price) {
    const fallback = extractFromFallback($, pageCurrency);
    if (fallback) {
      price = fallback;
      method = "fallback";
    }
  }

  image ??=
    resolveImage(
      jsonLd.image ??
        metaContent(
          $,
          'meta[property="og:image"],meta[name="twitter:image"],meta[itemprop="image"]',
        ),
      finalUrl,
    ) ?? null;
  if (!image) {
    image =
      resolveImage(
        $("img[itemprop='image']").first().attr("src") ??
          $("img[itemprop='image']").first().attr("content"),
        finalUrl,
      ) ?? null;
  }
  if (!image) {
    const candidate = $(
      "main img, article img, [itemtype*='Product'] img, .product img, .item.active img",
    )
      .not("[class*='logo'], [class*='icon'], [alt='']")
      .first();
    image =
      resolveImage(
        candidate.attr("src") ??
          candidate.attr("data-src") ??
          candidate.attr("data-srcset") ??
          candidate.attr("srcset"),
        finalUrl,
      ) ?? null;
  }

  availability ??=
    jsonLd.availability ?? meta.availability ?? microdata.availability ?? null;

  const currency =
    price?.currency ??
    detectCurrency("", pageCurrency, defaultCurrency()) ??
    defaultCurrency();

  return {
    title: title ? cleanPageTitle(title) : null,
    priceCents: price?.cents ?? null,
    currency: price?.currency ?? currency,
    imageUrl: image,
    availability,
    site: hostnameOf(finalUrl),
    finalUrl,
    method,
  };
}
