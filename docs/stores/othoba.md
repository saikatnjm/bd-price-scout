# Store research: Othoba (othoba.com)

Researched 2026-10-02 (Phase 3, redo after Shwapno was excluded). Findings are **[observed]** unless marked **[unverified]**.

## Store selection

I screened the remaining household targets on terms and robots first:

| Store | Result |
|---|---|
| Shwapno | **Excluded.** Terms 11.5 and 11.6 forbid automated access and scraping (`docs/stores/shwapno.md`). |
| Meena Bazar (`meenabazaronline.com`) | **Not suitable.** It is an Angular single-page app: the server returns a 4 KB empty shell for every path, `/robots.txt` included. Data is only available through its private API. |
| Daraz | Not screened in depth. It is a large marketplace known for strong bot protection; kept as a later candidate. |
| **Othoba** | **Selected.** Server-rendered (nopCommerce), real JSON-LD on product pages, no terms clause against automated access found. |

## 1. Store

- **Name:** Othoba, a marketplace with multiple vendors, including grocery sellers such as "Daily Shopping" and "Meghna Group of Industries"
- **Domain:** `https://othoba.com` (`www.` redirects to the apex)
- **Relevant pages:** Grocery at `/food-grocery` (2,352 products), and sub-categories such as `/oil` (45 products). Household Essentials is also listed in the menu.

## 2. Search findings

- **robots.txt [observed]:** `Disallow: /search?` and `Disallow: /category/products/`. Also disallowed: `/LoadProductInfoByProductId`, `/Catalog/GetTagProducts`, cart, checkout and customer paths. Product pages and plain category pages are allowed.
- **Text search** (`/search?q=…`) is therefore **off-limits**.
- **Sitemap:** none in `robots.txt`; `/sitemap.xml` returns an empty body.
- **Category pages are server-rendered:**
  - 40 product cards per page, with a "Showing 1 - 40 of 45 Products" footer and `?pagenumber=N` pagination (allowed).
  - `?pagesize=100` is ignored: still 40 per page.
  - Each card (`.product-wrap[data-productid]`) has the **product ID, name and URL** in the server HTML.
  - **Prices, sold counts and stock are not in the server HTML.** JavaScript fills them in after the page loads.
- **API:** no documented public API. The endpoint the page uses to load prices (`/LoadProductInfoByProductId`) is disallowed by `robots.txt`.
- **JavaScript:** not needed for category card identity or for product pages. It is needed only for the prices on category cards, which we won't use.

## 3. Product page findings

Pages checked: `/fresh-fortified-soyebean-oil-5ltr-meghna-group-of-industries-709817` (discounted) and `/mr-noodles-12-pcs-family-pack-masala-62gm-x-12pcs-33408` (12-piece multipack, not discounted). I also looked at `/fresh-fortified-soyebean-oil-5ltr-2`, a duplicate listing of the same oil from a different seller branch.

- **Server-side check** (GitHub Actions runner; plain `curl`, descriptive User-Agent, no cookies, 3 seconds apart; 6 requests over 2 runs):
  - Every request returned **HTTP 200**, with no redirects and no challenge page. Cloudflare served it from the IAD, ORD and DTW edges; IAD is the same region as Vercel's `iad1`.
  - Product pages were about **156–161 KB** and took 0.8–1.8 s. The `/oil` category page was 310 KB and took 0.6 s. All had `Cache-Control: no-cache, no-store`.
  - The site sets nopCommerce and AWS load-balancer cookies.
- In the browser, the page includes Cloudflare's script loader (`challenge-platform`). It did not block plain requests.
- **JSON-LD `Product` is in the server HTML** (with whitespace and `&gt;` entities). Microdata (`itemprop=price` etc.) is also present.

## 4. Available product fields

All from the JSON-LD `Product` unless noted.

**Identity**
| Field | Source | Example / notes |
|---|---|---|
| Product ID | JSON-LD `id`; card `data-productid` | `709817`. Internal, one per listing. |
| SKU | JSON-LD `sku` (also in `offers.sku`); HTML "SKU:" | `MGIN709817`, `DS33408`. Seller prefix + ID, so specific to the seller. |
| Name | JSON-LD `name`; `h1` | Can have double spaces or a trailing space. |
| Brand | JSON-LD `brand`; HTML "Brand:" | "Fresh", "Mr. Noodles". **Empty on some listings** (the duplicate Fresh oil). |
| MPN | JSON-LD `mpn` | **Not reliable.** Sometimes the product ID, sometimes a seller item code (`5500000078`), sometimes empty. |
| GTIN / EAN / UPC | **not present** | |
| Model | **not applicable** | |
| Variants | none observed | Each size or pack is its own listing. No attribute selectors on the checked pages. |

**Offer**
| Field | Source | Example / notes |
|---|---|---|
| Current price | JSON-LD `offers.sale_price` when present, otherwise `offers.price`; microdata `itemprop=price` | 990 (discounted oil), 265 (noodles). |
| Regular price | JSON-LD `offers.price` **when `sale_price` is present** | Oil: `price` 1000.00, `sale_price` 990.00. The page shows "Tk 990 / Tk 1,000 / 10 TK OFF". |
| Discount | derived; page text "10 TK OFF" or "1% OFF" | |
| Currency | `offers.priceCurrency` | `BDT`; the page shows "Tk". |
| Availability | `offers.availability` | `http://schema.org/InStock`; `http://schema.org/OutOfStock` (observed in Phase 4: the page shows a "SoldOut" button while the price stays visible). |
| Seller | `offers.seller`; `custom_label_0`; HTML "Seller:" | "Meghna Group of Industries" vs "Meghna Group of Industries Rajshahi". |
| Warranty | HTML | "Warranty Not Available" for groceries. |

**Category, media and URL**
| Field | Source | Example / notes |
|---|---|---|
| Category | `category`, `product_type` | "Grocery &gt; Oil", which needs HTML entities decoded. |
| Image | JSON-LD `image` | `images.othoba.com/...webp` |
| URL | JSON-LD `url` and `offers.url` | Canonical product URL. |

## 5. Household product findings

- **Pack size and unit:** in the **name**: "5ltr", "62gm x 12pcs", "250 ml", "1Kg", "1600gm".
  - Some seller descriptions also have semi-structured lines, e.g. "Brand: Mr. Noodles / Item code: 5500000078 / Quantity: 12 pack / Size: 62 gm".
  - These lines are seller-written free text, so they are **not reliable** as a primary source.
- **Multipacks:** the name shows the pack structure, e.g. "12 pcs Family Pack (62gm x 12pcs)". The card price is for the whole pack (Tk 265).
- **Bundles:** marked in the name, e.g. "Fresh Rice Bran Oil - 5ltr 4 Pcs Bundle" (Tk 3,940). Kept separate from single units.
- **Flavour:** in the name, e.g. "Magic Masala Flavor", "(Litchi)", "Carbonara Flavor".
- **Brand:** structured when the seller fills it in, otherwise empty.
- **Duplicates:** **the same product can be listed by several sellers**, each with its own ID, SKU and price.

## 6. Recommended adapter strategy (Phase 4)

**Discovery (compliant; no `/search?`):**
- Keep a small, fixed list of allowed Grocery and Household sub-category slugs (e.g. `oil`, plus others to be confirmed).
- For a query, pick the sub-categories whose name matches the query terms.
- Fetch at most 1–2 category pages and read the server-rendered cards (`data-productid`, name, href).
- Keep cards whose name contains all the meaningful query tokens.
- Fetch **5 or fewer** product pages in parallel with timeouts.
- Recall depends on how well the category map covers the query. That is a deliberate trade-off for compliance.

**Product extraction:**
- Read the JSON-LD `Product`, with HTML entities decoded and whitespace tolerated.
- `price` = `sale_price ?? price`; `regularPrice` = `price` only when `sale_price` is present.
- Availability: map the schema.org URL; unknown values stay `unknown`.
- Also keep the seller, SKU, product ID, brand (absent if empty), image and canonical URL.
- Cross-check the price against microdata `itemprop=price`. If they disagree, mark the product unreliable rather than guessing.
- Pack size and bundle flags are later normalization work, parsed from the name.

**Network:**
- Fetch only from a fixed host allowlist (`othoba.com`).
- Timeouts, a response size cap of about 1 MB, no cookie persistence, and a small fixed fetch count per query.

## 7. Matching implications

- **No GTIN.** The product ID and SKU are specific to Othoba and to the seller. MPN is unreliable.
- **Matching would rely on:**
  - brand (when present)
  - product line from the name
  - **exact pack size and unit** from the name
  - pack count (e.g. 12 pcs)
  - bundle flag (e.g. "4 Pcs Bundle")
  - flavour
- **Duplicate listings** from different sellers of the same item are expected. Within Othoba, keep each seller's offer separate.
- Missing brand lowers confidence.

## 8. Limitations / risks

- **Text search is disallowed by `robots.txt`.** Discovery through categories has limited recall and needs a maintained category map.
- **Prices aren't in category HTML**, so price comparison needs product-page fetches (about 160 KB each).
- **Terms:** no terms-and-conditions page was found (`/conditions-of-use` and other likely paths redirect home; the footer has only cancellation, privacy and EMI policies). The privacy policy has no clause about automated access. **[unverified]** whether terms exist elsewhere, e.g. in the app or at registration.
- **Out of stock** was observed in Phase 4 (`OutOfStock` with a "SoldOut" button). **Pre-order** was not observed. Unrecognized values map to `unknown`.
- **Data quality varies by seller:** brand is sometimes empty and MPN is inconsistent.
- **Cloudflare** is in front of the site. No challenge so far; if one appears, report the store as `blocked`. No bypass.
- **No location dependence** was observed: there is no store or area selector on product pages. **[unverified]**.

## 9. Phase 4 recommendation

Implement an Othoba adapter that:
1. Discovers products through allowed category pages.
2. Extracts product data from the JSON-LD `Product` on product pages.
3. Handles the `price`/`sale_price` rule, seller, and the possibility of missing brand.

Use saved HTML fixtures for:
- a discounted product
- a product without a discount
- a bundle or multipack
- a category page

Keep pack-size and bundle parsing for the normalization phase, unless it is needed to avoid misleading results.

## Phase 4 implementation notes (2026-10-02)

- **Adapter:** `src/server/stores/othoba/`. The category map, parsers and search flow live there. The shared safe fetch is `src/server/http/fetch-html.ts`.
- **Request budget per search:** at most 2 categories, 2 pages each, then at most 5 product pages.
- **Out of coverage:** queries that don't name a mapped category return no results without any request.
- **Live check, 2026-10-02:** "soybean oil 5 ltr" returned 5 products, in about 2.8 s from a GitHub runner. The fields matched the store pages:
  - 709817: Tk 990, regular 1000, in stock
  - 881121: 4-piece bundle, Tk 3,940, regular 4000
  - 25472 (Rupchanda): Tk 1,000, sold out
  - Seller, SKU and brand matched each page's meta line.
- **Seen live:** the brand field can hold a manufacturer name (e.g. "Bangladesh Edible Oil Ltd" for Rupchanda).

## Product images (Phase 5, 2026-10-02)

- **Source:** the JSON-LD `image`, an absolute https URL on `images.othoba.com`. The adapter only accepts Othoba image hosts.
- **Hotlink protection:** the image host returns **403 for `.jpeg` images when the Referer is another site** (here `bd-price-scout.vercel.app`). It returns 200 with no Referer or an Othoba Referer. `.webp` images return 200 for every Referer. This matches Cloudflare hotlink protection.
- **Decision:** we don't strip the Referer and don't proxy the images, because either would get around a protection the store chose to apply. Blocked images fall back to a "No image" placeholder; WebP images display normally.
