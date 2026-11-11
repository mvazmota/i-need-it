"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Item } from "@/lib/db/schema";
import { parseAmountToCents } from "@/lib/format";

const SUGGESTED_CATEGORIES = ["Tech", "Home", "Clothing", "Books", "Hobby", "Gifts"];

export function ItemSettings({
  item,
  categories,
}: {
  item: Item;
  categories: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url);
  const [target, setTarget] = useState(
    item.targetPriceCents !== null
      ? (item.targetPriceCents / 100).toFixed(2)
      : "",
  );
  const [category, setCategory] = useState(item.category ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [status, setStatus] = useState(item.status);
  const [interval, setInterval] = useState(String(item.checkIntervalHours));
  const [priceSelector, setPriceSelector] = useState(item.priceSelector ?? "");
  const [titleSelector, setTitleSelector] = useState(item.titleSelector ?? "");
  const [imageSelector, setImageSelector] = useState(item.imageSelector ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = [...new Set([...SUGGESTED_CATEGORIES, ...categories])];

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    let targetPriceCents: number | null = null;
    if (target.trim()) {
      targetPriceCents = parseAmountToCents(target);
      if (!targetPriceCents) {
        setError("That target price does not look right.");
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          url: url.trim(),
          targetPriceCents,
          category: category.trim() || null,
          notes: notes.trim() || null,
          status,
          checkIntervalHours: Number(interval),
          priceSelector: priceSelector.trim() || null,
          titleSelector: titleSelector.trim() || null,
          imageSelector: imageSelector.trim() || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Could not save the item.");
        return;
      }

      setMessage("Saved. Changes are live.");
      router.refresh();
    } catch {
      setError("Could not save the item. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const confirmed = window.confirm(
      `Delete "${item.title}" and all of its price history? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "Could not delete the item.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not delete the item. Check your connection.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Item settings</h2>
          <p className="mt-1 text-xs text-muted">
            Targeting, schedule, and selectors.
          </p>
        </div>
        {message ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-good">
            <Check className="size-3.5" strokeWidth={2.4} />
            {message}
          </span>
        ) : null}
      </div>

      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="settings-title" className="label">
            Title
          </label>
          <input
            id="settings-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="field mt-1.5"
            maxLength={180}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="settings-url" className="label">
            Product link
          </label>
          <input
            id="settings-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="field mt-1.5 font-mono text-xs"
            spellCheck={false}
            required
          />
          <p className="mt-1.5 text-[11px] text-muted">
            Changing the link schedules a fresh check on the next worker tick.
          </p>
        </div>

        <div>
          <label htmlFor="settings-target" className="label">
            Target price
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted">
              {item.currency}
            </span>
            <input
              id="settings-target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="No target"
              className="field pl-[3.4rem]"
              inputMode="decimal"
            />
          </div>
        </div>

        <div>
          <label htmlFor="settings-interval" className="label">
            Check every
          </label>
          <select
            id="settings-interval"
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
          <label htmlFor="settings-category" className="label">
            Category
          </label>
          <input
            id="settings-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="None"
            className="field mt-1.5"
            list={`settings-categories-${item.id}`}
            maxLength={60}
          />
          <datalist id={`settings-categories-${item.id}`}>
            {categoryOptions.map((entry) => (
              <option key={entry} value={entry} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="settings-status" className="label">
            Status
          </label>
          <select
            id="settings-status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as Item["status"])
            }
            className="field mt-1.5"
          >
            <option value="watching">Watching</option>
            <option value="paused">Paused</option>
            <option value="purchased">Purchased</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="settings-notes" className="label">
            Notes
          </label>
          <textarea
            id="settings-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Size, colour, variant…"
            className="textarea mt-1.5 min-h-20"
            maxLength={2000}
          />
        </div>

        <details className="group rounded-xl border border-line bg-paper/40 sm:col-span-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium">
            <span>
              Custom selectors
              <span className="ml-2 text-[11px] font-normal text-muted">
                price, title, image
              </span>
            </span>
            <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
            <p className="text-[11px] leading-5 text-muted sm:col-span-2">
              Leave these empty unless the checker cannot find the price. A
              selector such as <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[10px]">.price</code>{" "}
              or <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[10px]">[data-price]</code>{" "}
              overrides the generic reader.
            </p>
            <div>
              <label htmlFor="settings-price-selector" className="label">
                Price selector
              </label>
              <input
                id="settings-price-selector"
                value={priceSelector}
                onChange={(event) => setPriceSelector(event.target.value)}
                placeholder=".product-price"
                className="field mt-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </div>
            <div>
              <label htmlFor="settings-title-selector" className="label">
                Title selector
              </label>
              <input
                id="settings-title-selector"
                value={titleSelector}
                onChange={(event) => setTitleSelector(event.target.value)}
                placeholder="h1"
                className="field mt-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="settings-image-selector" className="label">
                Image selector
              </label>
              <input
                id="settings-image-selector"
                value={imageSelector}
                onChange={(event) => setImageSelector(event.target.value)}
                placeholder='img[itemprop="image"]'
                className="field mt-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </div>
          </div>
        </details>

        {error ? (
          <p className="rounded-xl border border-bad/20 bg-bad-soft px-3.5 py-2.5 text-xs text-bad sm:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className={cn("btn-primary h-10", saving && "cursor-wait")}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" strokeWidth={2} />
            )}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-col justify-between gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
        <p className="text-[11px] leading-5 text-muted">
          Deleting removes the item and its entire price history.
        </p>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="btn-danger"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" strokeWidth={2} />
          )}
          {deleting ? "Deleting…" : "Delete item"}
        </button>
      </div>
    </section>
  );
}
