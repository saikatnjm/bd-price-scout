import { formatBdt, formatPack, isSafeHttpUrl } from "@/lib/format";
import type { Availability, ComparisonGroup, Offer, SearchResponse, StoreStatus } from "@/lib/types";
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

function OfferRow({ offer, lowestPrice }: { offer: Offer; lowestPrice?: number }) {
  const saving =
    offer.discount?.amount ?? (offer.price !== null && offer.regularPrice !== null ? offer.regularPrice - offer.price : null);
  const isLowest = lowestPrice !== undefined && offer.price === lowestPrice && offer.availability === "in_stock";

  return (
    <li className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0 text-xs">
        <p className="font-medium text-slate-700 dark:text-slate-200">{offer.storeName}</p>
        {offer.seller && <p className="text-slate-500">Seller: {offer.seller}</p>}
        <p className={availabilityClass[offer.availability]}>{availabilityLabel[offer.availability]}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold">
          {offer.price === null ? "Price unavailable" : formatBdt(offer.price)}
          {isLowest && (
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              Lowest price
            </span>
          )}
        </p>
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
            className="mt-1 inline-block text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            View on {offer.storeName}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </li>
  );
}

function GroupCard({ group }: { group: ComparisonGroup }) {
  const pack = formatPack(group.pack);
  const variant = [group.variant?.flavour, group.variant?.scent, group.variant?.colour].filter(Boolean).join(" · ") || undefined;
  const imageSrc = group.imageUrl && isSafeHttpUrl(group.imageUrl) ? group.imageUrl : undefined;

  return (
    <li className="p-4" data-testid="product-group">
      <div className="flex gap-3">
        <ProductImage src={imageSrc} alt={group.title} />
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words">{group.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {pack && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{pack}</span>
            )}
            {variant && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{variant}</span>
            )}
            {group.brand && <span>{group.brand}</span>}
            {group.storeCount > 1 && <span>Same product at {group.storeCount} stores</span>}
          </div>
        </div>
      </div>
      <ul className="mt-2 divide-y divide-slate-100 sm:pl-[76px] dark:divide-slate-800">
        {group.offers.map((offer) => (
          <OfferRow key={`${offer.storeId}:${offer.url}`} offer={offer} lowestPrice={group.lowestPrice} />
        ))}
      </ul>
    </li>
  );
}

export function SearchResults({ data }: { data: SearchResponse }) {
  const failedStores = data.stores.filter((s) => s.status === "timeout" || s.status === "blocked" || s.status === "error");
  const allFailed = data.stores.length > 0 && failedStores.length === data.stores.length;
  const storesWithResults = [...new Set(data.results.map((o) => o.storeName))];

  return (
    <div className="space-y-6">
      {data.groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          <p>
            {data.stores.length === 0
              ? "No stores are configured yet."
              : allFailed
                ? "Stores could not be searched right now. Please try again."
                : `No products found for “${data.query}”.`}
          </p>
          {data.stores.length > 0 && !allFailed && (
            <p className="mt-1 text-xs text-slate-500">
              Stores are searched by category and only the first pages are checked, so some products can be missed. Try an English product name such as “rice 5kg”.
            </p>
          )}
        </div>
      ) : (
        <>
          {storesWithResults.length === 1 && (
            <p className="text-xs text-slate-500">
              {data.groups.length} {data.groups.length === 1 ? "product" : "products"}.{" "}
              Results from {storesWithResults[0]} only, so prices are not compared across stores.
            </p>
          )}
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {data.groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </ul>
        </>
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
