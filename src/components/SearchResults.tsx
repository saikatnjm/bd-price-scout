import { formatBdt, isSafeHttpUrl } from "@/lib/format";
import type { Availability, Offer, SearchResponse, StoreStatus } from "@/lib/types";
import { ProductImage } from "./ProductImage";

const availabilityLabel: Record<Availability, string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  preorder: "Pre-order",
  coming_soon: "Coming soon",
  unknown: "Availability unknown",
};

const availabilityClass: Record<Availability, string> = {
  in_stock: "text-emerald-700 dark:text-emerald-400",
  out_of_stock: "text-red-700 dark:text-red-400",
  preorder: "text-amber-700 dark:text-amber-400",
  coming_soon: "text-amber-700 dark:text-amber-400",
  unknown: "text-slate-500",
};

const storeStatusLabel: Record<StoreStatus["status"], string> = {
  ok: "OK",
  empty: "No results",
  timeout: "Timed out",
  blocked: "Blocked",
  error: "Failed",
};

function OfferCard({ offer }: { offer: Offer }) {
  const details = [offer.brand, offer.seller ? `Seller: ${offer.seller}` : undefined].filter(Boolean).join(" · ");
  const saving = offer.price !== null && offer.regularPrice !== null ? offer.regularPrice - offer.price : null;
  const imageSrc = offer.imageUrl && isSafeHttpUrl(offer.imageUrl) ? offer.imageUrl : undefined;

  return (
    <li className="flex gap-3 p-4">
      <ProductImage src={imageSrc} alt={offer.title} />
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{offer.title}</p>
        {details && <p className="mt-0.5 text-xs text-slate-500">{details}</p>}
        <p className="mt-1 text-xs">
          <span className="text-slate-500">{offer.storeName} · </span>
          <span className={availabilityClass[offer.availability]}>{availabilityLabel[offer.availability]}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold">{offer.price === null ? "Price unavailable" : formatBdt(offer.price)}</p>
        {offer.regularPrice !== null && saving !== null && saving > 0 && (
          <p className="text-xs text-slate-500">
            <span className="line-through">{formatBdt(offer.regularPrice)}</span> · Save {formatBdt(saving)}
          </p>
        )}
        {isSafeHttpUrl(offer.url) && (
          <a
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-2 inline-block text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            View product
          </a>
        )}
      </div>
    </li>
  );
}

export function SearchResults({ data }: { data: SearchResponse }) {
  const failedStores = data.stores.filter((s) => s.status === "timeout" || s.status === "blocked" || s.status === "error");
  const allFailed = data.stores.length > 0 && failedStores.length === data.stores.length;

  return (
    <div className="space-y-6">
      {data.results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {data.stores.length === 0
            ? "No stores are configured yet."
            : allFailed
              ? "Stores could not be searched right now. Please try again."
              : `No products found for “${data.query}”.`}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {data.results.map((offer) => (
            <OfferCard key={`${offer.storeId}:${offer.url}`} offer={offer} />
          ))}
        </ul>
      )}

      {failedStores.length > 0 && (
        <p role="note" className="text-xs text-amber-700 dark:text-amber-400">
          {data.results.length > 0 ? "Partial results: " : ""}
          {failedStores.map((s) => `${s.storeName} (${storeStatusLabel[s.status]}${s.message ? `: ${s.message}` : ""})`).join(", ")}.
        </p>
      )}

      <p className="text-xs text-slate-500">
        Checked {new Date(data.searchedAt).toLocaleString()} · Prices are store product prices, excluding delivery and coupons.
      </p>
    </div>
  );
}
