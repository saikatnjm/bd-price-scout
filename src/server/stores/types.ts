import "server-only";
import type { Availability } from "@/lib/types";

/** A product as found on a store, before normalization and matching. */
export interface StoreCandidate {
  title: string;
  url: string;
  price: number | null;
  regularPrice: number | null;
  availability: Availability;
  imageUrl?: string;
  /** Store-internal product ID (not a cross-store identifier). */
  storeProductId?: string;
  /** Store/seller SKU as published by the store. */
  sku?: string;
  brand?: string;
  /** Marketplace seller, when the store is a marketplace. */
  seller?: string;
  category?: string;
  /** Raw GTIN/EAN/UPC as published; validated during normalization. */
  gtin?: string;
  /** Manufacturer model identifier as published. */
  model?: string;
}

export interface StoreSearchContext {
  /** Aborted when the per-store timeout or overall search budget expires. */
  signal: AbortSignal;
}

/**
 * Every supported store implements this. Store-specific logic stays inside the adapter;
 * the orchestrator and UI never know how a store is scraped.
 */
export interface StoreAdapter {
  readonly id: string;
  readonly name: string;
  /** Fixed https origin; adapters may only fetch URLs on this origin. */
  readonly origin: string;
  search(query: string, ctx: StoreSearchContext): Promise<StoreCandidate[]>;
}

/** Thrown by adapters when the store refuses or challenges the request. */
export class StoreBlockedError extends Error {
  constructor(message = "Store blocked the request") {
    super(message);
    this.name = "StoreBlockedError";
  }
}

export type StoreErrorKind = "http" | "invalid_response" | "parse";

/**
 * A controlled store failure. `message` is safe to show to users; internal details
 * belong in `cause` and are only logged on the server.
 */
export class StoreError extends Error {
  constructor(
    readonly kind: StoreErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "StoreError";
  }
}
