"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { formatMoney, parseAmountToCents } from "@/lib/format";

export function ManualPriceForm({
  itemId,
  currency,
}: {
  itemId: string;
  currency: string;
}) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const priceCents = parseAmountToCents(price);
    if (!priceCents) {
      setError("Enter a price above zero.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/items/${itemId}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Could not save that price.");
        return;
      }

      setPrice("");
      setMessage(`Added ${formatMoney(priceCents, currency)} to the history.`);
      router.refresh();
    } catch {
      setError("Could not save that price. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-[1.55rem] font-normal leading-none tracking-[-0.01em]">Add a price manually</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        For shops that block automated checks, or when you spot a better price
        yourself. It lands in the same history and updates the current price.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted">
            {currency}
          </span>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
            className="field pl-[3.4rem]"
            inputMode="decimal"
            aria-label="Manual price"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !price.trim()}
          className="btn-secondary h-11 shrink-0"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : message ? (
            <Check className="size-4 text-good" strokeWidth={2.4} />
          ) : (
            <Plus className="size-4" strokeWidth={2.2} />
          )}
          {saving ? "Saving…" : "Add price"}
        </button>
      </form>
      {error ? <p className="mt-2 text-[11px] text-bad">{error}</p> : null}
      {message ? <p className="mt-2 text-[11px] text-good">{message}</p> : null}
    </section>
  );
}
