import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { isAuthConfigured } from "@/lib/auth";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="group flex items-baseline gap-1.5"
            aria-label="ineedit home"
          >
            <span className="text-[22px] font-semibold leading-none tracking-[-0.065em]">
              ineedit
            </span>
            <span className="mb-0.5 size-1.5 rounded-full bg-accent transition-transform duration-200 group-hover:scale-125" />
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/"
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-ink/5 hover:text-ink"
            >
              Wishlist
            </Link>
            <Link
              href="/?view=deals"
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-ink/5 hover:text-ink"
            >
              Deals
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/items/new"
            className="btn-primary h-9 px-4 text-[13px]"
          >
            <Plus className="size-4" strokeWidth={2.2} />
            Add item
          </Link>
          {isAuthConfigured() ? (
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="size-4" strokeWidth={1.8} />
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
