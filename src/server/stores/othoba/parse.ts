import "server-only";
import * as cheerio from "cheerio";
import { normalizeAvailability } from "@/server/normalize/fields";
import type { StoreCandidate } from "../types";

export const OTHOBA_ORIGIN = "https://othoba.com";
export const OTHOBA_HOSTS = ["othoba.com", "www.othoba.com"] as const;

export interface OthobaCard {
  productId: string;
  name: string;
  url: string;
}

export interface OthobaCategoryPage {
  cards: OthobaCard[];
  hasNextPage: boolean;
}

function clean(text: string | undefined | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Othoba HTML-encodes some JSON-LD string values (e.g. "Grocery &gt; Oil"). */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = clean(decodeEntities(String(value)));
  return result === "" ? undefined : result;
}

/** Absolute https URL on an Othoba host, or undefined. */
function othobaUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const url = new URL(value.trim(), OTHOBA_ORIGIN);
    if (url.protocol !== "https:" || url.port !== "" || !(OTHOBA_HOSTS as readonly string[]).includes(url.hostname)) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

// Product images are served from Othoba's own image host (observed in JSON-LD).
const OTHOBA_IMAGE_HOSTS: readonly string[] = ["images.othoba.com", "othoba.com"];

/** Absolute https product image URL on Othoba's image host, or undefined. */
function imageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const url = new URL(value.trim(), OTHOBA_ORIGIN);
    return url.protocol === "https:" && url.port === "" && OTHOBA_IMAGE_HOSTS.includes(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function money(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}


export function parseCategoryPage(html: string): OthobaCategoryPage {
  const $ = cheerio.load(html);
  const cards: OthobaCard[] = [];
  const seen = new Set<string>();
  $(".product-wrap[data-productid]").each((_, el) => {
    const card = $(el);
    const productId = clean(card.attr("data-productid"));
    const link = card.find(".product-name a").first();
    const name = clean(link.text());
    const url = othobaUrl(link.attr("href"));
    if (!/^\d+$/.test(productId) || !name || !url || seen.has(productId)) return;
    seen.add(productId);
    cards.push({ productId, name, url });
  });
  const hasNextPage = $(".pagination a.page-link[data-page]").length > 0 &&
    $(".pagination .page-item.active").nextAll(".page-item").find("a[href]").length > 0;
  return { cards, hasNextPage };
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findProductJsonLd($: cheerio.CheerioAPI): JsonObject | null {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      continue; // One malformed block must not hide a valid one.
    }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (isObject(item) && item["@type"] === "Product") return item;
    }
  }
  return null;
}

const COMPANY_SUFFIX = /\b(ltd|limited|pvt|private|co|company|inc|corp|corporation)\b/g;

function party(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(COMPANY_SUFFIX, " ").replace(/\s+/g, " ").trim();
}

/**
 * Othoba's "Brand" field is sometimes filled with the marketplace seller's name
 * (observed: Brand "VistaMart" / Seller "VistaMart" on a Dark Fantasy biscuit,
 * Brand "Bango Millers" / Seller "Bango Millers Ltd." on PRAN rice). Such a value says
 * who sells the item, not who makes it, so it is dropped rather than shown as a brand.
 * Only an exact name match (ignoring company suffixes) is dropped: a brand's own store
 * ("Himalaya" sold by "Himalaya Wellness Bangladesh") keeps its brand.
 */
function brandUnlessSeller(brand: string | undefined, seller: string | undefined): string | undefined {
  if (!brand || !seller) return brand;
  const b = party(brand);
  const s = party(seller);
  if (b === "" || b === s) return undefined;
  return brand;
}

/**
 * Extracts a product from an Othoba product page's JSON-LD. Returns null when the page
 * has no usable Product data. Missing fields stay absent; nothing is guessed.
 */
export function parseProductPage(html: string, pageUrl: string): StoreCandidate | null {
  const $ = cheerio.load(html);
  const product = findProductJsonLd($);
  if (!product) return null;

  const title = text(product.name);
  if (!title) return null;

  const offerRaw = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const offer = isObject(offerRaw) ? offerRaw : {};
  const currency = text(offer.priceCurrency);

  // Othoba's JSON-LD: with a discount, `price` is the regular price and `sale_price` is
  // what the customer pays; without a discount only `price` is present.
  const listed = money(offer.price);
  const sale = money(offer.sale_price);
  let price = sale ?? listed;
  const regularPrice = sale !== null && listed !== null && listed > sale ? listed : null;

  // Cross-check against the visible microdata price; on disagreement report no price
  // rather than guess which one is right.
  const microdata = money($('[itemprop="price"]').first().attr("content"));
  if (currency !== "BDT" || (price !== null && microdata !== null && microdata !== price)) price = null;

  const seller = text(offer.seller) ?? text(product.custom_label_0);

  return {
    title,
    url: othobaUrl(offer.url) ?? othobaUrl(product.url) ?? pageUrl,
    price,
    regularPrice: price === null ? null : regularPrice,
    availability: normalizeAvailability(offer.availability),
    imageUrl: imageUrl(Array.isArray(product.image) ? product.image[0] : product.image),
    storeProductId: text(product.id),
    sku: text(product.sku) ?? text(offer.sku),
    brand: brandUnlessSeller(text(product.brand), seller),
    seller,
    category: text(product.category),
  };
}
