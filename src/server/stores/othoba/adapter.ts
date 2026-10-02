import "server-only";
import { fetchHtml } from "@/server/http/fetch-html";
import { queryTokens, tokenize } from "@/server/search/tokens";
import { StoreError, type StoreAdapter, type StoreCandidate, type StoreSearchContext } from "../types";
import { OTHOBA_SPELLING_VARIANTS, selectCategories } from "./categories";
import { OTHOBA_HOSTS, OTHOBA_ORIGIN, parseCategoryPage, parseProductPage, type OthobaCard } from "./parse";

// Request budget per search: at most 2 categories x 2 pages, then 5 product pages.
const MAX_CATEGORIES = 2;
const MAX_PAGES_PER_CATEGORY = 2;
const MAX_PRODUCTS = 5;

/** A card is a candidate only if its name contains every query word (or a known spelling variant). */
function cardMatches(card: OthobaCard, tokens: readonly string[]): boolean {
  const nameTokens = new Set(tokenize(card.name));
  return tokens.every((t) => nameTokens.has(t) || (OTHOBA_SPELLING_VARIANTS[t] ?? []).some((v) => nameTokens.has(v)));
}

/** Runs every task and throws the first error only if none succeeded. */
async function allOrFirstError<T>(tasks: Promise<T>[]): Promise<T[]> {
  const settled = await Promise.allSettled(tasks);
  const ok = settled.filter((s): s is PromiseFulfilledResult<T> => s.status === "fulfilled").map((s) => s.value);
  const failed = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
  if (ok.length === 0 && failed) throw failed.reason;
  return ok;
}

async function findCards(slug: string, tokens: readonly string[], ctx: StoreSearchContext): Promise<OthobaCard[]> {
  const matches: OthobaCard[] = [];
  for (let page = 1; page <= MAX_PAGES_PER_CATEGORY; page++) {
    const url = page === 1 ? `${OTHOBA_ORIGIN}/${slug}` : `${OTHOBA_ORIGIN}/${slug}?pagenumber=${page}`;
    const html = await fetchHtml(url, { signal: ctx.signal, allowedHosts: OTHOBA_HOSTS });
    const result = parseCategoryPage(html);
    matches.push(...result.cards.filter((c) => cardMatches(c, tokens)));
    if (matches.length >= MAX_PRODUCTS || !result.hasNextPage) break;
  }
  return matches;
}

async function loadProduct(card: OthobaCard, ctx: StoreSearchContext): Promise<StoreCandidate | null> {
  const html = await fetchHtml(card.url, { signal: ctx.signal, allowedHosts: OTHOBA_HOSTS });
  return parseProductPage(html, card.url);
}

export const othobaAdapter: StoreAdapter = {
  id: "othoba",
  name: "Othoba",
  origin: OTHOBA_ORIGIN,

  async search(query, ctx) {
    const tokens = queryTokens(query);
    const categories = selectCategories(tokens, MAX_CATEGORIES);
    if (tokens.length === 0 || categories.length === 0) return []; // Query outside the supported categories.

    const perCategory = await allOrFirstError(categories.map((c) => findCards(c.slug, tokens, ctx)));
    const unique = new Map<string, OthobaCard>();
    for (const card of perCategory.flat()) if (!unique.has(card.productId)) unique.set(card.productId, card);
    const cards = [...unique.values()].slice(0, MAX_PRODUCTS);
    if (cards.length === 0) return [];

    const products = await allOrFirstError(cards.map((card) => loadProduct(card, ctx)));
    const parsed = products.filter((p): p is StoreCandidate => p !== null);
    // Pages loaded but none had product data: the page format changed. Report it
    // instead of a misleading "no results".
    if (parsed.length === 0 && products.length > 0) {
      throw new StoreError("parse", "Store page format was not recognised.");
    }
    return parsed;
  },
};
