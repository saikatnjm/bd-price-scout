import type { ComparisonGroup, MatchBasis, Offer } from "./types";

/**
 * Builds the display/comparison summary for offers already confirmed to be the same
 * product. Pure and shared by server and client; it performs no matching itself.
 */
export function buildGroup(offers: readonly Offer[], matchBasis?: MatchBasis): ComparisonGroup {
  const first = offers[0];
  if (!first) throw new Error("A comparison group needs at least one offer");

  const storeCount = new Set(offers.map((o) => o.storeId)).size;
  // A "lowest price" only exists when different stores sell the same product in stock.
  const priced = offers.filter((o) => o.price !== null && o.availability === "in_stock");
  const pricedStores = new Set(priced.map((o) => o.storeId)).size;

  const group: ComparisonGroup = {
    id: `${first.storeId}:${first.storeProductId ?? first.url}`,
    title: first.title,
    offers: [...offers],
    storeCount,
  };
  const imageUrl = offers.find((o) => o.imageUrl)?.imageUrl;
  if (first.brand) group.brand = first.brand;
  if (imageUrl) group.imageUrl = imageUrl;
  if (first.pack) group.pack = first.pack;
  if (first.variant) group.variant = first.variant;
  if (offers.length > 1 && matchBasis) group.matchBasis = matchBasis;
  if (pricedStores >= 2) group.lowestPrice = Math.min(...priced.map((o) => o.price as number));
  return group;
}
