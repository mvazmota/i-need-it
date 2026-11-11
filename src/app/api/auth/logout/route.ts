import { NextResponse } from "next/server";
import {
  isAuthConfigured,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL(isAuthConfigured() ? "/login" : "/", request.url),
    303,
  );
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
