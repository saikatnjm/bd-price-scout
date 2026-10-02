# Store research: Shwapno (shwapno.com)

Researched 2026-10-02 (Phase 3, household and daily-needs focus). Findings are **[observed]** unless marked **[unverified]**.

## 1. Store selected

- **Name:** Shwapno, the ACI Logistics supermarket chain
- **Domain:** `https://www.shwapno.com`
- **Relevant pages:**
  - Category pages such as `/food`, `/oil`, `/soybean-oil`, `/tea`
  - Search at `/search?q=`
  - Product pages at `/<seName>`
- **Why:** it is the largest supermarket chain on the target list, and its catalogue is groceries, toiletries, cleaning and household goods.

## 2. Search findings

- **Mechanism:** `https://www.shwapno.com/search?q=soybean%20oil` renders results, but **only on the client**.
  - The server HTML for the search page (about 797 KB) contains no results.
  - The browser then calls the internal endpoint `GET /api/search?q=soybean+oil&pageNumber=1&requestType=0&userToken=<session token>`, plus `/api/search/banner?...`.
  - A real search for "soybean oil" returned relevant results:
    - Rupchanda, Fresh, Star Ship and Teer oil in 1, 2 and 5 litre sizes, e.g. "Rupchanda Soyabean Oil 5Ltr. ৳1,000 Per Piece" and "Rupchanda Soyabean Oil 1Ltr. ৳204".
    - One tuna-in-soybean-oil product also appeared.
- **API:** no documented public API. `/api/search` is a private, session-bound endpoint (it needs a `userToken`).
- **robots.txt:** disallows `/api*` and `/*?*` (every URL with a query string). Both `/search?q=` and `/api/search` are therefore disallowed.
- **Category pages:** these also render products on the client. The server HTML for `/soybean-oil` contains breadcrumbs only, with no product list or prices.
- **JavaScript:** required for search and category listings.
- **Sitemap:** `robots.txt` publishes it. `/sitemap.xml` is an index of 7 sitemaps (categories, brands, tags, deals, catalogs, products, …). `/sitemap-products.xml` is a further index of **23 product sitemaps**, all with `lastmod 2026-10-02`.

## 3. Product page findings

Product pages (`/<seName>`, no query string) are allowed by `robots.txt`.

**Pages checked in the browser:**
- `/rupchanda-soyabean-oil-5liter`: packaged, regular price, in stock.
- `/piyaj-local-loose-p-kg`: loose onions sold per kg, discounted.
- `/Himalaya-AD-Shampoo-SM-180mlBOGOF`: buy-one-get-one-free bundle.

**Server-side check** (GitHub Actions runner, Azure datacenter IP, Cloudflare ORD edge; plain `curl`, descriptive User-Agent, no cookies, 3 seconds apart) on `robots.txt`, the oil page and the onion page:
- All returned **HTTP 200**, with no redirects and no challenge page.
- Product pages took **1.7–2.0 s** and were **about 910 KB** each, with `Cache-Control: private, no-store`. The site sets a `cuid` cookie.
- All the product data below was present in the server HTML, with the store defaulting to `currentStoreName: "Banani"`.
- In the browser, Cloudflare's bot-detection script (`/cdn-cgi/challenge-platform/.../jsd`) also loads. It did not block the plain HTTP requests.

**Where the data sits:**
- Next.js App Router. Product data is inside the React Server Components page data (`self.__next_f.push(...)` chunks) in the server HTML.
- A schema.org `Product` JSON-LD object is embedded there and becomes a `<script type="application/ld+json">` only after the page loads. The raw HTML has no ordinary JSON-LD script tag.
- The same page data includes a fuller **product model object** (see section 4).

## 4. Available product fields

Sources: **JSON-LD** = the schema.org Product inside the page data; **Model** = the embedded product model object; **HTML** = visible text.

**Identity**
| Field | Source | Example |
|---|---|---|
| Name | Model `name`; JSON-LD `name` | "Rupchanda Soyabean Oil 5Ltr." The JSON-LD name adds "Shop … at Shwapno.com". |
| Brand | Model `productManufacturers[].name`; JSON-LD `brand` | "Rupchanda", "Himalaya". **Empty for loose produce** (onion). |
| Product ID | Model `id` (24-character hex ObjectId) | `65efed594029080802d03910` |
| SKU | Model `sku`; JSON-LD `sku`; HTML "SKU:" | `2400019`. Internal store code. |
| GTIN / EAN / UPC | **not found** | No barcode or GTIN field in JSON-LD, the model or the specs. |
| Model number | **not applicable** | Not present. |
| Variant | **none** | Each size or pack is a separate product, e.g. 1L, 2L and 5L. No variant selector seen. |

**Offer**
| Field | Source | Example |
|---|---|---|
| Price | Model `price.priceValue`; JSON-LD `offers.price` | 1000, 48, 270 |
| Original price and discount | Model `price.oldPriceValue`, `price.discountAmountValue`, `discountStartDate`, `discountEndDate` | Onion: old 55, now 48, discount 7, valid to 2026-10-10. When there's no discount, `oldPrice` is missing and `discountAmountValue` is 0. |
| Availability | Model `stock` / `stockAvailability`; JSON-LD `offers.availability` | `InStock` / "In-stock". **Out of stock was not observed.** |
| Seller | implicit | Shwapno is a single retailer. The model also gives `currentStoreName`: "Banani". |
| Order limits | Model `orderMinimumQuantity`, `orderMaximumQuantity` | Oil: max 1. Shampoo: max 6. |

**Size and unit**
| Field | Source | Example |
|---|---|---|
| Sales unit | Model `unit`, `uomType` | "Piece" / 10 for packaged goods; "Kg" / 20 for loose goods (`orderPackageQuantity` 1000). |
| Pack size | **name and slug text only** | "5Ltr.", "180(±)10ml", "185(±)20gm". The spec groups (Origin, Ingredients, Packaging, Certifications) have no size field. |
| Bundle / promotion | Name text and model `productRibbons[].title` | "(Buy1 Get1 Free)" with ribbon "B1G1". Price 270 for the bundle. |

**Category, media and URL**
| Field | Source | Example |
|---|---|---|
| Category | JSON-LD BreadcrumbList; model breadcrumb | Food › Cooking › Oil › Soybean Oil |
| Image | JSON-LD `image`; model `pictures`; `og:image` | CloudFront webp |
| URL | JSON-LD `url`; model `seName` | `https://www.shwapno.com/rupchanda-soyabean-oil-5liter`. Note that `og:url` adds `?lang=en`. |

## 5. Household product findings

- **Pack size (500g vs 1kg, ml/L):** available only as free text in the name or slug. The formats vary: "5Ltr.", "1Ltr.", "2 ltr", "180(±)10ml", "185(±)20gm", "200gm", "50 gm". Size has to be parsed from the name, and the "(±)" tolerance notation must be handled.
- **Unit of sale:** `unit` / `uomType` reliably separate per-piece goods from per-kg loose goods. For loose items the price is per kg, not per pack.
- **Multipacks and bundles:** buy-one-get-one-free shows up in the name ("(Buy1 Get1 Free)") and the "B1G1" ribbon. **[unverified]** whether other multipack forms ("2 x", "Pack of 6", "10X15g") always appear consistently. One example seen in a slug: "Seylon Instant Milk Tea 3in1 10X15g 150g".
- **Flavour and scent:** name text only, e.g. "Lemon", "Neem", "Orange".
- **Brand:** structured (manufacturer) for branded goods, empty for loose produce.
- **Variants:** each size is its own product page and its own SKU. That suits strict matching.

## 6. Recommended adapter strategy

**Technically possible (not recommended; see section 8):**
- Fetch the product page (`/<seName>`) server-side.
- Parse the `self.__next_f` page-data chunks, find the embedded product model (`uomType`, `price`, `stock`, `sku`, `id`), and cross-check against the embedded JSON-LD `Product`.
- Find candidates through `sitemap-products-N.xml` (23 files), matching against slugs. Search and category pages need JavaScript or the private API, which is disallowed.
- Parsing Next.js page data is more fragile than ordinary JSON-LD: the format is internal to Next.js and can change with framework upgrades.

## 7. Matching implications

- **No GTIN or barcode.** The SKU and product ID are internal to Shwapno, so there is no identifier shared with other stores.
- **Matching would rely on:**
  - brand (missing for loose produce)
  - the product line from the name
  - **pack size and unit parsed from the name** (it must match exactly)
  - unit type: per piece or per kg
  - flavour or scent words
  - a bundle flag from the name or ribbon (B1G1)
- **Rules:**
  - A B1G1 bundle must never be compared with a single unit.
  - A per-kg price must never be compared with a per-pack price.
  - A size tolerance such as "180(±)10ml" should be kept as 180 ml.
- **Confidence:** with no shared identifier, cross-store matches would be "likely" at best, unless a later store provides GTINs.

## 8. Limitations / risks

- **Terms of service prohibit automated access and scraping.** From `https://www.shwapno.com/tac` (Terms and Condition):
  - Clause 11.5: "Do not use or launch any automated system or program in connection with our website or its online ordering functionality."
  - Clause 11.6: "… or scrape or hack the website."
  - **This rules out a server-side adapter under the project's rule to respect terms.**
- **robots.txt** disallows search (`/*?*`) and the API (`/api*`).
- Search and listings depend on JavaScript and a private session-bound API.
- **Prices and stock depend on location:**
  - Pages are served for a default "dark store" (`currentStoreName: "Banani"`, `darkStoreId` in API calls) until a delivery location is chosen.
  - **[unverified]** whether prices differ between dark stores. Stock very likely does.
- Pages are heavy (about 910 KB) and slow (about 2 s), with `no-store` caching.
- Cloudflare bot detection is present. Plain requests weren't challenged in this test, but that could change.
- How out-of-stock is represented was not observed.
- **Name-only pack sizes** make matching harder.

## 9. Phase 4 recommendation

**Do not build a Shwapno adapter.** Its terms (11.5, 11.6) explicitly forbid automated access and scraping, and its `robots.txt` blocks search and the API. If Shwapno were ever permitted, for example through written permission or an official feed or API, an adapter would need to:
- discover products via the product sitemaps (or the permitted feed)
- fetch product pages
- parse the embedded product model and JSON-LD
- parse pack size and unit from the name
- flag bundles
- treat prices as belonging to the default dark store

For Phase 4, research another target store (Meena Bazar, Othoba or Daraz), checking its terms before anything technical.
