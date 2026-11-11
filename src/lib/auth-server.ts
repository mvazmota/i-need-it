import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isAuthConfigured,
  SESSION_COOKIE,
  safeEqual,
  sessionToken,
} from "./auth";

export async function isAuthenticated(): Promise<boolean> {
  if (!isAuthConfigured()) return true;

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  return safeEqual(token, await sessionToken());
}

export async function requirePageAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}

export async function requireApiAuth(): Promise<Response | null> {
  if (await isAuthenticated()) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
