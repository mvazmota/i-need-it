import { requirePageAuth } from "@/lib/auth-server";
import { Nav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAuth();

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        {children}
      </main>
      <footer className="mt-auto border-t border-line/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-5 text-[11px] text-muted sm:px-6 lg:px-8">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent" />
            ineedit · self-hosted on your own Pi
          </span>
          <span className="hidden sm:inline">
            Scheduler: {process.env.CHECK_CRON?.trim() || "*/15 * * * *"}
          </span>
        </div>
      </footer>
    </>
  );
}
