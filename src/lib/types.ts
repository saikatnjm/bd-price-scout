// Shared between server and client. Must not import server-only code.

export type Availability = "in_stock" | "out_of_stock" | "preorder" | "coming_soon" | "unknown";

export type SizeUnit = "g" | "kg" | "ml" | "l" | "sheet";

/**
 * Package information parsed conservatively from the product name. Fields are absent
 * when the name does not state them unambiguously; nothing is guessed.
 */
export interface PackageInfo {
  /** Size of one item as written, e.g. 5 l, 62 g, 100 sheets. */
  size?: { value: number; unit: SizeUnit };
  /** Number of items in the pack when stated (e.g. "12 pcs", "10 x 15g", "Pack of 6"). */
  count?: number;
  /** count > 1. */
  multipack: boolean;
  /** Bundle / combo / buy-one-get-one wording in the name. */
  bundle: boolean;
  /** Total content in base units (g, ml) or pieces, only when computable from stated values. */
  total?: { value: number; unit: "g" | "ml" | "sheet" | "piece" };
}

/** Variant attributes stated explicitly in the name (e.g. "Masala Flavor"). */
export interface VariantInfo {
  flavour?: string;
  scent?: string;
  colour?: string;
}

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
  /** Validated GTIN/EAN/UPC (checksum verified), when the store publishes one. */
  gtin?: string;
  /** Manufacturer model identifier, when the store publishes one. */
  model?: string;
  /** Present only when both current and original prices are known and original > current. */
  discount?: { amount: number; percent: number };
  pack?: PackageInfo;
  variant?: VariantInfo;
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
