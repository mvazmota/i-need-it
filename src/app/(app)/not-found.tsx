import Link from "next/link";
import { PackageSearch } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-ink/5 text-muted">
        <PackageSearch className="size-5" strokeWidth={1.6} />
      </div>
      <h1 className="mt-4 font-display text-[2.2rem] font-normal tracking-[-0.01em]">
        That item is not here.
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        It may have been deleted, or the link is wrong.
      </p>
      <Link href="/" className="btn-primary mt-5 h-10">
        Back to the wishlist
      </Link>
    </div>
  );
}
