import "server-only";
import type { Availability } from "@/lib/types";

/** Collapses whitespace; undefined for empty values. Never rewrites content. */
export function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  return text === "" ? undefined : text;
}

const PLACEHOLDER_BRANDS = new Set(["n/a", "na", "none", "null", "-", "no brand", "unbranded"]);

export function normalizeBrand(value: unknown): string | undefined {
  const brand = cleanText(value);
  return brand && !PLACEHOLDER_BRANDS.has(brand.toLowerCase()) ? brand : undefined;
}

/** GTIN-8/12/13/14 with a valid check digit; anything else is dropped, never repaired. */
export function normalizeGtin(value: unknown): string | undefined {
  const digits = typeof value === "string" || typeof value === "number" ? String(value).replace(/[\s-]/g, "") : "";
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return undefined;
  const body = digits.slice(0, -1);
  const sum = [...body].reverse().reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1)) ? digits : undefined;
}

/** A positive finite amount rounded to paisa, else null. */
export function normalizeAmount(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[,৳\s]|tk\.?|bdt/gi, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export interface NormalizedPrice {
  price: number | null;
  regularPrice: number | null;
  discount?: { amount: number; percent: number };
}

/** A regular price is kept only when it exceeds a known current price; no discount is derived otherwise. */
export function normalizePrice(current: unknown, original: unknown): NormalizedPrice {
  const price = normalizeAmount(current);
  const listed = normalizeAmount(original);
  if (price === null || listed === null || listed <= price) return { price, regularPrice: null };
  const amount = Math.round((listed - price) * 100) / 100;
  return { price, regularPrice: listed, discount: { amount, percent: Math.round((amount / listed) * 1000) / 10 } };
}

const AVAILABILITY_VALUES: Record<string, Availability> = {
  instock: "in_stock",
  in_stock: "in_stock",
  limitedavailability: "in_stock",
  onlineonly: "in_stock",
  outofstock: "out_of_stock",
  out_of_stock: "out_of_stock",
  soldout: "out_of_stock",
  preorder: "preorder",
  presale: "preorder",
  coming_soon: "coming_soon",
  unknown: "unknown",
};

/**
 * Maps schema.org URLs/terms and our own values to the shared availability states.
 * Missing or unclear values are "unknown" (never assumed out of stock); "discontinued"
 * is not mapped to out-of-stock because its meaning varies by store.
 */
export function normalizeAvailability(value: unknown): Availability {
  if (typeof value !== "string") return "unknown";
  const key = value.trim().replace(/^https?:\/\/schema\.org\//i, "").toLowerCase().replace(/[\s-]/g, "");
  return AVAILABILITY_VALUES[key] ?? "unknown";
}

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|ref|_ga)$/i;

/** http(s) URL with fragment and tracking parameters removed; undefined if invalid. */
export function normalizeUrl(value: unknown, options: { httpsOnly?: boolean } = {}): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const url = new URL(value.trim());
    const allowed = options.httpsOnly ? ["https:"] : ["https:", "http:"];
    if (!allowed.includes(url.protocol) || url.username || url.password) return undefined;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return undefined;
  }
}
