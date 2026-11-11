"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Toolbar({
  q,
  sort,
  category,
  categories,
  status,
  dealsOnly,
}: {
  q: string;
  sort: string;
  category: string | null;
  categories: string[];
  status: string;
  dealsOnly: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [pending, startTransition] = useTransition();

  function navigate(patch: {
    q?: string;
    sort?: string;
    category?: string | null;
  }) {
    const params = new URLSearchParams();

    if (dealsOnly) {
      params.set("view", "deals");
    } else if (status !== "watching") {
      params.set("status", status);
    }

    const nextQuery = patch.q ?? query;
    if (nextQuery.trim()) params.set("q", nextQuery.trim());

    const nextCategory = patch.category !== undefined ? patch.category : category;
    if (nextCategory) params.set("category", nextCategory);

    const nextSort = patch.sort ?? sort;
    if (nextSort && nextSort !== "newest") params.set("sort", nextSort);

    startTransition(() => {
      const search = params.toString();
      router.push(search ? `/?${search}` : "/");
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form
        className="relative min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ q: query });
        }}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, shops, notes…"
          className="field pl-10 pr-9"
          aria-label="Search wishlist"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              navigate({ q: "" });
            }}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </form>

      <div className="flex gap-2">
        {categories.length > 0 ? (
          <select
            value={category ?? ""}
            onChange={(event) =>
              navigate({ category: event.target.value || null })
            }
            className="field h-9 flex-1 rounded-full px-3 text-xs sm:w-40 sm:flex-none"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={sort}
          onChange={(event) => navigate({ sort: event.target.value })}
          className="field h-9 flex-1 rounded-full px-3 text-xs sm:w-44 sm:flex-none"
          aria-label="Sort items"
        >
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="drop">Biggest drop</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <span
        className={cn(
          "hidden text-[11px] text-muted lg:block",
          pending && "opacity-100",
        )}
        aria-live="polite"
      >
        {pending ? "Updating…" : ""}
      </span>
    </div>
  );
}
