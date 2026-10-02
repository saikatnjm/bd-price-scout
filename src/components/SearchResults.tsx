import { formatBdt, isSafeHttpUrl } from "@/lib/format";
import type { Availability, SearchResponse, StoreStatus } from "@/lib/types";

const availabilityLabel: Record<Availability, string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  preorder: "Pre-order",
  coming_soon: "Coming soon",
  unknown: "Availability unknown",
};

const storeStatusLabel: Record<StoreStatus["status"], string> = {
  ok: "OK",
  empty: "No results",
  timeout: "Timed out",
  blocked: "Blocked",
  error: "Failed",
};

export function SearchResults({ data }: { data: SearchResponse }) {
  const failedStores = data.stores.filter((s) => s.status === "timeout" || s.status === "blocked" || s.status === "error");

  return (
    <div className="space-y-6">
      {data.results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {data.stores.length === 0
            ? "No stores are configured yet."
            : `No products found for “${data.query}”.`}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {data.results.map((offer) => (
            <li key={`${offer.storeId}:${offer.url}`} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium break-words">{offer.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {offer.storeName}
                  {offer.seller ? ` · Seller: ${offer.seller}` : ""} · {availabilityLabel[offer.availability]}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{offer.price === null ? "Price unavailable" : formatBdt(offer.price)}</p>
                {offer.price !== null && offer.regularPrice !== null && (
                  <p className="text-xs text-slate-500 line-through">{formatBdt(offer.regularPrice)}</p>
                )}
                {isSafeHttpUrl(offer.url) && (
                  <a href={offer.url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-emerald-700 underline dark:text-emerald-400">
                    View at store
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {failedStores.length > 0 && (
        <p role="note" className="text-xs text-amber-700 dark:text-amber-400">
          Partial results: {failedStores.map((s) => `${s.storeName} (${storeStatusLabel[s.status]})`).join(", ")}.
        </p>
      )}

      <p className="text-xs text-slate-500">
        Checked {new Date(data.searchedAt).toLocaleString()} · Prices are store product prices, excluding delivery and coupons.
      </p>
    </div>
  );
}
