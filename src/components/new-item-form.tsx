"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney, parseAmountToCents } from "@/lib/format";
import { ProductImage } from "./product-image";

type InspectInfo = {
  title: string | null;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
  availability: string | null;
  site: string;
  finalUrl: string;
  method: string;
};

const SUGGESTED_CATEGORIES = ["Tech", "Home", "Clothing", "Books", "Hobby", "Gifts"];

function isLikelyUrl(value: string): boolean {
  if (!value || value.length < 5) return false;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function NewItemForm({
  defaultCurrency,
  categories,
  initialUrl = "",
}: {
  defaultCurrency: string;
  categories: string[];
  initialUrl?: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState("");
  const titleTouched = useRef(false);
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [interval, setInterval] = useState("6");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [priceSelector, setPriceSelector] = useState("");
  const [titleSelector, setTitleSelector] = useState("");
  const [imageSelector, setImageSelector] = useState("");
  const [preview, setPreview] = useState<InspectInfo | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectNonce, setInspectNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = url.trim();
    if (!isLikelyUrl(trimmed)) {
      setPreview(null);
      setWarning(null);
      setInspectError(null);
      setInspecting(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setInspecting(true);
    setInspectError(null);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            url: trimmed,
            priceSelector: priceSelector.trim() || undefined,
            titleSelector: titleSelector.trim() || undefined,
            imageSelector: imageSelector.trim() || undefined,
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | { info?: InspectInfo; warning?: string | null; error?: string }
          | null;

        if (cancelled) return;

        if (!response.ok || !data?.info) {
          setPreview(null);
          setWarning(null);
          setInspectError(data?.error ?? "Could not read that page.");
          return;
        }

        setPreview(data.info);
        setWarning(data.warning ?? null);
        setCurrency(data.info.currency || defaultCurrency);
        if (!titleTouched.current && data.info.title) {
          setTitle(data.info.title);
        }
      } catch (error) {
        if (cancelled || (error as Error).name === "AbortError") return;
        setPreview(null);
        setInspectError("Could not reach the app. Check your connection.");
      } finally {
        if (!cancelled) setInspecting(false);
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    url,
    inspectNonce,
    defaultCurrency,
    priceSelector,
    titleSelector,
    imageSelector,
  ]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setDuplicateId(null);

    if (!url.trim()) {
      setFormError("Paste a product link first.");
      return;
    }

    let targetPriceCents: number | null = null;
    if (target.trim()) {
      targetPriceCents = parseAmountToCents(target);
      if (!targetPriceCents) {
        setFormError("That target price does not look right.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          imageUrl: preview?.imageUrl ?? undefined,
          currency,
          targetPriceCents,
          category: category.trim() || undefined,
          notes: notes.trim() || undefined,
          checkIntervalHours: Number(interval),
          priceSelector: priceSelector.trim() || undefined,
          titleSelector: titleSelector.trim() || undefined,
          imageSelector: imageSelector.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { item?: { id: string }; error?: string; itemId?: string }
        | null;

      if (response.status === 409 && data?.itemId) {
        setDuplicateId(data.itemId);
        setFormError(data.error ?? "This link is already on your list.");
        return;
      }

      if (!response.ok || !data?.item) {
        setFormError(data?.error ?? "Could not add that item. Try again.");
        return;
      }

      router.push(`/items/${data.item.id}`);
    } catch {
      setFormError("Could not add that item. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  const categoriesForDatalist = [
    ...new Set([...SUGGESTED_CATEGORIES, ...categories]),
  ];

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card p-5 sm:p-6">
        <label htmlFor="product-url" className="label">
          Product link
        </label>
        <div className="relative mt-2">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            id="product-url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setFormError(null);
              setDuplicateId(null);
            }}
            placeholder="https://shop.example.com/product…"
            className="field h-12 pl-10 pr-4 text-[15px]"
            autoFocus
            spellCheck={false}
            inputMode="url"
          />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          Paste from any shop. We look for structured product data, Open Graph
          tags, microdata, and common price elements.
        </p>

        <div className="mt-4">
          {inspecting ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/60 p-3.5">
              <Loader2 className="size-4 animate-spin text-accent" />
              <span className="text-[13px] text-ink-soft">
                Reading the product page…
              </span>
            </div>
          ) : preview ? (
            <div className="rounded-xl border border-line bg-paper/60 p-3">
              <div className="flex gap-3">
                <ProductImage
                  key={preview.imageUrl ?? "no-image"}
                  src={preview.imageUrl}
                  alt={preview.title ?? "Product preview"}
                  className="size-20 shrink-0 rounded-lg border border-line bg-surface"
                  imageClassName="p-1.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.13em] text-muted">
                    <Check className="size-3 text-good" strokeWidth={2.4} />
                    Page found · {preview.site}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-5">
                    {preview.title ?? "Untitled product"}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-soft">
                    {preview.priceCents !== null ? (
                      <span className="font-semibold text-ink">
                        {formatMoney(preview.priceCents, preview.currency)}
                      </span>
                    ) : (
                      <span className="font-medium text-bad">
                        No price found automatically
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectNonce((value) => value + 1)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
                  title="Read the page again"
                  aria-label="Read the page again"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              </div>
              {warning ? (
                <p className="mt-2.5 flex items-start gap-1.5 border-t border-line pt-2.5 text-[11px] leading-5 text-accent-dark">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  {warning}
                </p>
              ) : null}
            </div>
          ) : inspectError ? (
            <div className="rounded-xl border border-accent/20 bg-accent-soft/60 p-3.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent-dark" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-accent-dark">
                    Preview unavailable
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-accent-dark/80">
                    {inspectError}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-accent-dark/70">
                    You can still add the link and set a custom selector later.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectNonce((value) => value + 1)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-accent-dark transition hover:bg-accent/10"
                  title="Try again"
                  aria-label="Try again"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              </div>
            </div>
          ) : url.trim() && !isLikelyUrl(url) ? (
            <p className="text-[11px] text-muted">
              That does not look like a complete link yet.
            </p>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3.5 py-3 text-[11px] text-muted">
              <Sparkles className="size-3.5 text-accent" strokeWidth={1.8} />
              A preview with title, image, and price will appear here.
            </div>
          )}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Item details</h2>
        <p className="mt-1 text-xs text-muted">
          Only the link is required. Everything else can be changed later.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="item-title" className="label">
              Title
            </label>
            <input
              id="item-title"
              value={title}
              onChange={(event) => {
                titleTouched.current = true;
                setTitle(event.target.value);
              }}
              placeholder={preview?.title ?? "Product name"}
              className="field mt-1.5"
              maxLength={180}
            />
          </div>

          <div>
            <label htmlFor="target-price" className="label">
              Target price <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted">
                {currency}
              </span>
              <input
                id="target-price"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="0.00"
                className="field pl-[3.4rem]"
                inputMode="decimal"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              You&apos;ll get a badge and an optional push when the price hits it.
            </p>
          </div>

          <div>
            <label htmlFor="item-category" className="label">
              Category <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="item-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="e.g. Tech"
              className="field mt-1.5"
              list="category-suggestions"
              maxLength={60}
            />
            <datalist id="category-suggestions">
              {categoriesForDatalist.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="check-interval" className="label">
              Check every
            </label>
            <select
              id="check-interval"
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
              className="field mt-1.5"
            >
              <option value="1">1 hour</option>
              <option value="3">3 hours</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">Daily</option>
              <option value="48">Every 2 days</option>
              <option value="168">Weekly</option>
            </select>
          </div>

          <div>
            <span className="label">Currency</span>
            <div className="mt-1.5 flex h-11 items-center rounded-xl border border-line bg-paper/60 px-3.5 text-[13px] font-semibold text-ink-soft">
              {currency}
              <span className="ml-2 text-[11px] font-normal text-muted">
                {preview
                  ? "detected from the page"
                  : "default until the page is read"}
              </span>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="item-notes" className="label">
              Notes <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="item-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Size, colour, variant, why you want it…"
              className="textarea mt-1.5 min-h-20"
              maxLength={2000}
            />
          </div>
        </div>

        <details className="group mt-5 rounded-xl border border-line bg-paper/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium">
            <span>
              Custom selectors
              <span className="ml-2 text-[11px] font-normal text-muted">
                only if the price is not found
              </span>
            </span>
            <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
            <p className="text-[11px] leading-5 text-muted sm:col-span-2">
              CSS selectors read straight from the page. Right-click the price in
              your browser → Inspect, then copy a stable selector from that
              element. Examples:{" "}
              <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[10px]">
                .price
              </code>
              ,{" "}
              <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[10px]">
                [data-testid=&quot;price&quot;]
              </code>
              .
            </p>
            <div>
              <label htmlFor="price-selector" className="label">
                Price selector
              </label>
              <input
                id="price-selector"
                value={priceSelector}
                onChange={(event) => setPriceSelector(event.target.value)}
                placeholder=".product-price"
                className="field mt-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </div>
            <div>
              <label htmlFor="title-selector" className="label">
                Title selector
              </label>
              <input
                id="title-selector"
                value={titleSelector}
                onChange={(event) => setTitleSelector(event.target.value)}
                placeholder="h1"
                className="field mt-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="image-selector" className="label">
                Image selector
              </label>
              <input
                id="image-selector"
                value={imageSelector}
                onChange={(event) => setImageSelector(event.target.value)}
                placeholder='img[itemprop="image"]'
                className="field mt-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </div>
          </div>
        </details>
      </section>

      {formError ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
          <AlertCircle className="size-4 shrink-0" />
          <span>{formError}</span>
          {duplicateId ? (
            <Link
              href={`/items/${duplicateId}`}
              className="font-semibold underline underline-offset-4"
            >
              Open the existing item →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="btn-ghost h-9 justify-center sm:justify-start">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || !url.trim()}
          className={cn("btn-primary", submitting && "cursor-wait")}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" strokeWidth={2.2} />
          )}
          {submitting ? "Reading page & saving…" : "Add to wishlist"}
        </button>
      </div>
    </form>
  );
}
