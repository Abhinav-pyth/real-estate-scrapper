import { NextRequest } from "next/server";
import { getLocalityPriceStats } from "@/lib/priceStats";
import { ok, notFound, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const sp = req.nextUrl.searchParams;
    const stats = await getLocalityPriceStats({
      slug: params.slug,
      transactionType: sp.get("transactionType") || undefined,
      propertyType: sp.get("propertyType") || undefined,
    });
    if (!stats) return notFound("Locality not found");
    return ok(stats);
  } catch (e) {
    return serverError(e);
  }
}
