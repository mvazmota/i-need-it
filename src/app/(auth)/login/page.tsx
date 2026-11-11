import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { isAuthConfigured } from "@/lib/auth";
import { isAuthenticated } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  if (!isAuthConfigured()) redirect("/");
  if (await isAuthenticated()) redirect("/");

  const usernameRequired = Boolean(process.env.APP_USERNAME?.trim());

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute left-1/2 top-0 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-12rem] right-[-8rem] size-[28rem] rounded-full bg-ink/[0.035] blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center">
          <Link href="/" className="flex items-baseline gap-1.5" aria-label="ineedit">
            <span className="text-[24px] font-semibold leading-none tracking-[-0.065em]">
              ineedit
            </span>
            <span className="mb-0.5 size-1.5 rounded-full bg-accent" />
          </Link>
        </div>

        <div className="card mt-6 p-6 sm:p-7">
          <p className="label">Private wishlist</p>
          <h1 className="mt-2 font-display text-[2.35rem] font-normal leading-none tracking-[-0.01em]">
            Welcome back.
          </h1>
          <p className="mt-1.5 text-[13px] leading-6 text-muted">
            Enter the username and password from your{" "}
            <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[11px]">
              .env
            </code>{" "}
            file to open the list.
          </p>
          <LoginForm usernameRequired={usernameRequired} />
        </div>

        <p className="mt-5 text-center text-[11px] text-muted">
          One login. Your data never leaves your Raspberry Pi.
        </p>
      </div>
    </main>
  );
}
