import "server-only";
import type { Offer, SearchResponse, StoreStatus } from "@/lib/types";
import type { SearchConfig } from "../config";
import { StoreBlockedError, type StoreAdapter } from "../stores/types";

class StoreTimeoutError extends Error {}

/** Rejects when the signal aborts, even if the adapter ignores the signal. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new StoreTimeoutError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new StoreTimeoutError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

async function searchStore(
  adapter: StoreAdapter,
  query: string,
  config: SearchConfig,
  budgetSignal: AbortSignal,
): Promise<{ status: StoreStatus; offers: Offer[] }> {
  const started = Date.now();
  const signal = AbortSignal.any([AbortSignal.timeout(config.storeTimeoutMs), budgetSignal]);
  const base = { storeId: adapter.id, storeName: adapter.name };

  try {
    const candidates = await untilAborted(adapter.search(query, { signal }), signal);
    const checkedAt = new Date().toISOString();
    const offers: Offer[] = candidates.map((c) => ({ ...base, ...c, currency: "BDT", checkedAt }));
    return {
      offers,
      status: {
        ...base,
        status: offers.length > 0 ? "ok" : "empty",
        durationMs: Date.now() - started,
        resultCount: offers.length,
      },
    };
  } catch (err) {
    const timedOut = err instanceof StoreTimeoutError || signal.aborted;
    const blocked = err instanceof StoreBlockedError;
    if (!timedOut && !blocked) console.error(`Store "${adapter.id}" search failed`, err);
    return {
      offers: [],
      status: {
        ...base,
        status: timedOut ? "timeout" : blocked ? "blocked" : "error",
        durationMs: Date.now() - started,
        resultCount: 0,
        message: timedOut
          ? "Store took too long to respond."
          : blocked
            ? "Store refused the request."
            : "Store search failed.",
      },
    };
  }
}

/** Searches all stores in parallel. A failing or slow store never fails the whole search. */
export async function runSearch(
  query: string,
  adapters: readonly StoreAdapter[],
  config: SearchConfig,
): Promise<SearchResponse> {
  const budgetSignal = AbortSignal.timeout(config.budgetMs);
  const outcomes = await Promise.all(adapters.map((a) => searchStore(a, query, config, budgetSignal)));

  return {
    query,
    results: outcomes.flatMap((o) => o.offers),
    stores: outcomes.map((o) => o.status),
    searchedAt: new Date().toISOString(),
  };
}
