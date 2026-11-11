"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
  UserRound,
} from "lucide-react";

export function LoginForm({ usernameRequired }: { usernameRequired: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    password.length > 0 &&
    (!usernameRequired || username.trim().length > 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Could not sign in.");
        return;
      }

      // A full navigation is intentional: it guarantees the fresh session
      // cookie is sent through the proxy before the dashboard loads.
      window.location.assign("/");
    } catch {
      setError("Could not reach the app. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      {usernameRequired ? (
        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <div className="relative mt-1.5">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="martin"
              className="field h-12 pl-10"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <div className="relative mt-1.5">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
            className="field h-12 pl-10"
            autoComplete="current-password"
            autoFocus={!usernameRequired}
            required
          />
        </div>
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 text-[12px] leading-5 text-bad">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="btn-primary h-12 w-full"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowRight className="size-4" strokeWidth={2.2} />
        )}
        {loading ? "Checking…" : "Open my wishlist"}
      </button>
    </form>
  );
}
