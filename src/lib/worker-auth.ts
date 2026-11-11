import { safeEqual } from "./auth";

export function workerAuthError(request: Request): Response | null {
  const expected = process.env.WORKER_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "WORKER_TOKEN is not configured on the server." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";

  if (!token || !safeEqual(token, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
