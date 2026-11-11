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
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
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
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.04em]">
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
          One password. Your data never leaves your Raspberry Pi.
        </p>
      </div>
    </main>
  );
}
