import { NextResponse } from "next/server";
import {
  isAuthConfigured,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionToken,
  verifyCredentials,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ ok: true });
  }

  let username = "";
  let password = "";

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        username?: unknown;
        password?: unknown;
      };
      username = typeof body.username === "string" ? body.username.trim() : "";
      password = typeof body.password === "string" ? body.password : "";
    } else {
      const form = await request.formData();
      username = String(form.get("username") ?? "").trim();
      password = String(form.get("password") ?? "");
    }
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!password || !(await verifyCredentials(username, password))) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return NextResponse.json(
      { error: "Wrong username or password. Try again." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await sessionToken(), sessionCookieOptions());
  return response;
}
