// Shared between server and client. Must not import server-only code.

export type Availability = "in_stock" | "out_of_stock" | "preorder" | "coming_soon" | "unknown";

export type StoreStatusKind = "ok" | "empty" | "timeout" | "blocked" | "error";

export interface Offer {
  storeId: string;
  storeName: string;
  title: string;
  url: string;
  /** Current product price in BDT; null when the store shows no price. */
  price: number | null;
  /** Pre-discount price in BDT when the store shows one. */
  regularPrice: number | null;
  currency: "BDT";
  availability: Availability;
  imageUrl?: string;
  /** Store-internal product ID (not a cross-store identifier). */
  storeProductId?: string;
  sku?: string;
  brand?: string;
  /** Marketplace seller, when the store is a marketplace. */
  seller?: string;
  category?: string;
  checkedAt: string;
}

export interface StoreStatus {
  storeId: string;
  storeName: string;
  status: StoreStatusKind;
  durationMs: number;
  resultCount: number;
  message?: string;
}

export interface SearchResponse {
  query: string;
  results: Offer[];
  stores: StoreStatus[];
  searchedAt: string;
}

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_QUERY"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export const QUERY_MIN_LENGTH = 2;
export const QUERY_MAX_LENGTH = 120;
