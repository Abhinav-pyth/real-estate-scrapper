import { NextRequest } from "next/server";
import { getPropertyPriceHistory } from "@/lib/priceStats";
import { ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return ok(await getPropertyPriceHistory(params.id));
  } catch (e) {
    return serverError(e);
  }
}
