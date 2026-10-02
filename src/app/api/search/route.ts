import { getSearchConfig } from "@/server/config";
import { toErrorResponse } from "@/server/errors";
import { runSearch } from "@/server/search/orchestrator";
import { parseSearchRequest } from "@/server/search/validate";
import { storeAdapters } from "@/server/stores/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  try {
    const { query } = parseSearchRequest(await request.text());
    const result = await runSearch(query, storeAdapters, getSearchConfig());
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
