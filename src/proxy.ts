import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthConfigured,
  SESSION_COOKIE,
  safeEqual,
  sessionToken,
} from "@/lib/auth";

export async function proxy(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && safeEqual(token, await sessionToken())) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|login|api/auth/login|api/auth/logout|api/health|api/hermes).*)",
  ],
};
