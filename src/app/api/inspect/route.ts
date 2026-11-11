import { requireApiAuth } from "@/lib/auth-server";
import { normalizeUrl } from "@/lib/format";
import { inspectUrl, ScrapeError } from "@/lib/scrape";
import { firstIssue, inspectSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = inspectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  let url: string;
  try {
    url = normalizeUrl(parsed.data.url);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }

  try {
    const info = await inspectUrl(url, {
      priceSelector: parsed.data.priceSelector,
      titleSelector: parsed.data.titleSelector,
      imageSelector: parsed.data.imageSelector,
    });

    return Response.json({
      info,
      warning:
        info.priceCents === null
          ? "A page was found, but no price could be read automatically. You can add the item and set a custom price selector later."
          : null,
    });
  } catch (error) {
    if (error instanceof ScrapeError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("[inspect]", error);
    return Response.json(
      { error: "Could not inspect that page. Try again." },
      { status: 500 },
    );
  }
}
