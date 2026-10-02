import "server-only";
import type { Offer } from "@/lib/types";
import type { StoreCandidate } from "../stores/types";
import { parsePackage } from "./package";
import { cleanText, normalizeAvailability, normalizeBrand, normalizeGtin, normalizePrice, normalizeUrl } from "./fields";
import { parseVariant } from "./variant";

export interface StoreRef {
  storeId: string;
  storeName: string;
}

/**
 * Maps a store adapter's candidate into the shared Offer shape. Returns null when the
 * candidate lacks the minimum needed to show it (name and a valid product URL).
 * Store identifiers are kept as published and stay tied to their store.
 */
export function normalizeCandidate(candidate: StoreCandidate, store: StoreRef, checkedAt: string): Offer | null {
  const title = cleanText(candidate.title);
  const url = normalizeUrl(candidate.url);
  if (!title || !url) return null;

  const { price, regularPrice, discount } = normalizePrice(candidate.price, candidate.regularPrice);
  const offer: Offer = {
    storeId: store.storeId,
    storeName: store.storeName,
    title,
    url,
    price,
    regularPrice,
    currency: "BDT",
    availability: normalizeAvailability(candidate.availability),
    pack: parsePackage(title),
    checkedAt,
  };

  const optional = {
    imageUrl: normalizeUrl(candidate.imageUrl, { httpsOnly: true }),
    storeProductId: cleanText(candidate.storeProductId),
    sku: cleanText(candidate.sku),
    brand: normalizeBrand(candidate.brand),
    seller: cleanText(candidate.seller),
    category: cleanText(candidate.category),
    gtin: normalizeGtin(candidate.gtin),
    model: cleanText(candidate.model),
    variant: parseVariant(title),
    discount,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) Object.assign(offer, { [key]: value });
  }
  return offer;
}
