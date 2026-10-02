import { buildGroup } from "./groups";
import type { ApiErrorBody, Availability, ComparisonGroup, MatchBasis, Offer, SearchResponse, StoreStatus } from "./types";

export class SearchRequestError extends Error {}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string";
}

const AVAILABILITIES: readonly Availability[] = ["in_stock", "out_of_stock", "preorder", "coming_soon", "unknown"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const optionalString = (v: unknown) => v === undefined || typeof v === "string";
const priceValue = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));

/** Runtime check so one malformed result cannot break rendering of the others. */
function isOffer(value: unknown): value is Offer {
  return (
    isRecord(value) &&
    typeof value.storeId === "string" &&
    typeof value.storeName === "string" &&
    typeof value.title === "string" &&
    value.title.trim() !== "" &&
    typeof value.url === "string" &&
    priceValue(value.price) &&
    priceValue(value.regularPrice) &&
    AVAILABILITIES.includes(value.availability as Availability) &&
    optionalString(value.imageUrl) &&
    optionalString(value.brand) &&
    optionalString(value.seller)
  );
}

function isStoreStatus(value: unknown): value is StoreStatus {
  return isRecord(value) && typeof value.storeId === "string" && typeof value.storeName === "string" && typeof value.status === "string";
}

const MATCH_BASES: readonly MatchBasis[] = ["same_listing", "gtin", "model", "attributes"];

/** Rebuilds groups from validated offers; a group whose offers are all malformed is dropped. */
function toGroups(raw: unknown, results: Offer[]): ComparisonGroup[] {
  if (!Array.isArray(raw)) return results.map((offer) => buildGroup([offer])); // older API: one group per offer
  const groups: ComparisonGroup[] = [];
  for (const g of raw) {
    if (!isRecord(g) || !Array.isArray(g.offers)) continue;
    const offers = g.offers.filter(isOffer);
    if (offers.length === 0) continue;
    const basis = MATCH_BASES.includes(g.matchBasis as MatchBasis) ? (g.matchBasis as MatchBasis) : undefined;
    groups.push(buildGroup(offers, basis));
  }
  return groups;
}

/** Validates the API payload; drops malformed results rather than failing the whole search. */
export function toSearchResponse(body: unknown): SearchResponse {
  if (!isRecord(body) || !Array.isArray(body.results) || !Array.isArray(body.stores) || typeof body.query !== "string") {
    throw new SearchRequestError("The server returned an invalid response.");
  }
  const results = body.results.filter(isOffer);
  return {
    query: body.query,
    results,
    groups: toGroups(body.groups, results),
    stores: body.stores.filter(isStoreStatus),
    searchedAt: typeof body.searchedAt === "string" ? body.searchedAt : new Date().toISOString(),
  };
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  let response: Response;
  try {
    response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new SearchRequestError("Could not reach the server. Check your connection and try again.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SearchRequestError(
      isApiErrorBody(body) ? body.error.message : `Search failed (HTTP ${response.status}).`,
    );
  }
  return toSearchResponse(body);
}
