"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

export function CheckButton({
  itemId,
  variant = "compact",
  className,
}: {
  itemId: string;
  variant?: "compact" | "full";
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/items/${itemId}/check`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "The price check failed.");
      }
      router.refresh();
    } catch {
      setError("Could not reach the app. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "full") {
    return (
      <div className={cn("flex flex-col items-end gap-1", className)}>
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="btn-secondary h-10"
        >
          <RefreshCw
            className={cn("size-4", loading && "animate-spin")}
            strokeWidth={2}
          />
          {loading ? "Checking…" : "Check price"}
        </button>
        {error ? (
          <span className="max-w-64 text-right text-[11px] leading-4 text-bad">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={check}
      disabled={loading}
      title={error ?? "Check price now"}
      aria-label="Check price now"
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-50",
        error && "text-bad hover:text-bad",
        className,
      )}
    >
      {loading ? (
        <RefreshCw className="size-4 animate-spin" strokeWidth={1.9} />
      ) : error ? (
        <AlertCircle className="size-4" strokeWidth={1.9} />
      ) : (
        <RefreshCw className="size-4" strokeWidth={1.9} />
      )}
    </button>
  );
}
