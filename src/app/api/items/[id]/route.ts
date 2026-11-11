import { and, eq, ne } from "drizzle-orm";
import { requireApiAuth } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { hostnameOf, normalizeUrl } from "@/lib/format";
import {
  emptyToNull,
  firstIssue,
  updateItemSchema,
} from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = db.select().from(items).where(eq(items.id, id)).get();
  if (!existing) {
    return Response.json({ error: "Item not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const payload = parsed.data;
  const updates: Partial<typeof items.$inferInsert> = { updatedAt: new Date() };

  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.targetPriceCents !== undefined) {
    updates.targetPriceCents = payload.targetPriceCents;
  }
  if (payload.category !== undefined) {
    updates.category = emptyToNull(payload.category);
  }
  if (payload.notes !== undefined) updates.notes = emptyToNull(payload.notes);
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.checkIntervalHours !== undefined) {
    updates.checkIntervalHours = payload.checkIntervalHours;
  }
  if (payload.priceSelector !== undefined) {
    updates.priceSelector = emptyToNull(payload.priceSelector);
  }
  if (payload.titleSelector !== undefined) {
    updates.titleSelector = emptyToNull(payload.titleSelector);
  }
  if (payload.imageSelector !== undefined) {
    updates.imageSelector = emptyToNull(payload.imageSelector);
  }

  if (payload.url !== undefined) {
    let url: string;
    try {
      url = normalizeUrl(payload.url);
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 });
    }

    const duplicate = db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.url, url), ne(items.id, id)))
      .get();
    if (duplicate) {
      return Response.json(
        { error: "Another item already tracks this link.", itemId: duplicate.id },
        { status: 409 },
      );
    }

    updates.url = url;
    updates.site = hostnameOf(url);
    updates.lastCheckedAt = null;
    updates.lastError = null;
  }

  db.update(items).set(updates).where(eq(items.id, id)).run();
  const updated = db.select().from(items).where(eq(items.id, id)).get();

  return Response.json({ item: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = db.select({ id: items.id }).from(items).where(eq(items.id, id)).get();
  if (!existing) {
    return Response.json({ error: "Item not found." }, { status: 404 });
  }

  db.delete(items).where(eq(items.id, id)).run();
  return Response.json({ ok: true });
}
