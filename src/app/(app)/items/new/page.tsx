import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewItemForm } from "@/components/new-item-form";
import { defaultCurrency } from "@/lib/parse-price";
import { getCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add item",
};

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialUrl =
    typeof params.url === "string" ? params.url : "";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Back to wishlist
      </Link>

      <div className="mt-5">
        <p className="label">New item</p>
        <h1 className="mt-2 font-display text-[clamp(2.2rem,3.8vw,3rem)] font-normal leading-[0.98] tracking-[-0.012em]">
          Paste a link. We&apos;ll watch the price.
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-6 text-ink-soft">
          Works with most shops that publish a visible price. You can fine-tune
          the target and the check schedule after adding it.
        </p>
      </div>

      <div className="mt-7">
        <NewItemForm
          defaultCurrency={defaultCurrency()}
          categories={getCategories()}
          initialUrl={initialUrl}
        />
      </div>
    </div>
  );
}
