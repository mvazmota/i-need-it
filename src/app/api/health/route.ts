import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    db.run(sql`select 1`);
    return Response.json({ ok: true, time: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
