import { eq } from "drizzle-orm";
import { requireApiAuth } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { checkItemPrice } from "@/worker/check";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = db.select({ id: items.id }).from(items).where(eq(items.id, id)).get();
  if (!existing) {
    return Response.json({ error: "Item not found." }, { status: 404 });
  }

  const result = await checkItemPrice(id);
  if (!result.ok) {
    return Response.json(
      { error: result.error, itemId: result.itemId },
      { status: 422 },
    );
  }

  return Response.json(result);
}
