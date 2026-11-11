export const SESSION_COOKIE = "ineedit_session";
const SESSION_MESSAGE = "ineedit-session-v1";

export function isAuthConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export function configuredUsername(): string {
  return process.env.APP_USERNAME?.trim() ?? "";
}

function sessionSecret(): string {
  return `${process.env.APP_PASSWORD ?? ""}::${process.env.AUTH_SECRET ?? ""}`;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sessionToken(): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(SESSION_MESSAGE),
  );

  return toHex(signature);
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const expectedPassword = process.env.APP_PASSWORD;
  if (!expectedPassword) return true;

  const expectedUsername = configuredUsername();
  if (expectedUsername && !safeEqual(username, expectedUsername)) {
    return false;
  }

  return safeEqual(password, expectedPassword);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
