# Store research: Star Tech (startech.com.bd)

Researched 2026-10-02 (Phase 3). Observed facts are marked **[observed]**; anything not directly seen is marked **[assumption]** or **[unverified]**.

## Store

- **Name:** Star Tech Ltd
- **Base domain:** `https://www.startech.com.bd` (apex `startech.com.bd` serves the same site)
- **Why:** a large Bangladeshi electronics retailer with structured product pages (schema.org microdata and Open Graph product tags), a single seller, and server-rendered HTML. It was the first store chosen in Phase 0.

## robots.txt and terms

**[observed]** `https://www.startech.com.bd/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /*?product_id=   /*?component_id=   /*?product_set_id=   /*?category_id=
Disallow: /*?pc_id=        /*?tracking=       /*?offer_id=         /*?&tag=
Disallow: /product/search?*
sitemap:https://www.startech.com.bd/sitemap.xml
```

- **The search results path is disallowed for all user agents.** Product pages (`/<slug>`), category pages and the sitemap are allowed.
- **[observed]** No general terms-of-service page with rules on automated access was found. The footer's "Terms and Condition" link goes to `/warranty-policy`. A text search there (and on `/emi-terms`) found no clause about scraping, crawling or bots.

## Search

Inspected only in the browser, as a normal visitor. No automated server-side requests were made to the search path.

- **URL [observed]:** `GET /product/search?search=<q>`, with optional `&page=N`, `&limit=20|25|50|75|90` (default 20) and `&sort=p.price&order=ASC|DESC`.
- **Result structure [observed]:**
  - Each result is a `.p-item` card containing:
    - name and link: `.p-item-name a`
    - 228×228 webp image: `.p-item-img img`
    - price: `.p-item-price`, with `.price-new` / `.price-old` when discounted
    - discount badge: `.marks .mark` ("Save: 449৳")
    - action label: "Buy Now" / "Out Of Stock" / "Up Coming"
  - The internal product ID only appears inside `onclick="cart.add('45147', '1')"` / `compare.add('45147')`.
  - There is no JSON-LD on search pages.
- **Pagination [observed]:** a "Showing 1 to 20 of 65 (4 Pages)" footer, plus `page=` links.
- **Relevance is poor [observed]:**
  - `galaxy s25` returned 10 results. Two were phones: the S25 FE, and the S25 Edge ("Up Coming"). The other 8 were chargers and cables. It returned no S25, S25+ or S25 Ultra listing. **[unverified]** whether those models are in the catalogue at all.
  - `iphone 16` returned 65 results, mostly accessories, plus an iPhone 17. No iPhone 16 listing appeared on page 1.
  - Results are not ranked by relevance to the model name.

## Product page

- **URL pattern [observed]:** `https://www.startech.com.bd/<slug>` (for example `/iphone-17`, `/samsung-galaxy-s25-fe`). The slug has no ID in it. A `<link rel="canonical">` is present.
- **Server-side access [observed]:**
  - Requests came from a GitHub Actions runner (Azure datacenter IP, Cloudflare LAX edge): plain `curl`, a descriptive User-Agent, no cookies, 3 seconds apart.
  - `robots.txt` and 2 product pages all returned **HTTP 200**, with no redirects and no Cloudflare challenge (`server: cloudflare`, no `cf-mitigated` header, no challenge markup).
  - Product pages took about 0.4 s and were **about 430 KB** each, with `Cache-Control: no-store`. The site sets `PHPSESSID`, `language` and `currency` cookies.
  - No rate-limit headers were seen.
  - **[unverified]** Behaviour from Vercel's own IPs (AWS, `iad1`). Phase 4 must re-check this from the deployment.
- **JavaScript:** not needed. **[observed]** All the fields below are in the server-rendered HTML; the server-side fetch found the microdata, Open Graph tags, info table and options.

## Extraction evidence

Pages checked: iPhone 17 (in stock, discounted, colour and region options), Samsung Galaxy S25 FE (in stock, RAM/storage option), Samsung Galaxy S25 Edge (Up Coming) and Ugreen PB572 power bank (Out Of Stock).

**Identity**
| Field | Source | Notes |
|---|---|---|
| name | HTML `h1`; microdata `[itemtype=schema.org/Product] [itemprop=name]` | The microdata `name` must be scoped: FAQ entries on the same page also use `itemprop="name"`. `og:title` has an SEO suffix. |
| brand | Open Graph `product:brand`; info table "Brand"; microdata `brand` | Consistent across all four pages. |
| model | HTML key-features line `Model: …` (`.short-description`) | Found on iPhone 17 ("iPhone 17"), S25 FE ("Galaxy S25 FE") and PB572 ("PB572"). Free text, and not guaranteed on every product **[assumption]**. |
| SKU / product ID | microdata `sku` = `product:retailer_item_id` = info table "Product Code" = search card `cart.add('<id>')` | Internal Star Tech ID (for example 44942). It is not a manufacturer SKU. |
| GTIN / EAN / UPC | **unavailable** | Not found in microdata, meta tags or specs on any checked page. |
| manufacturer part no. | sometimes in the title (for example `#45328`, `#65619B` for Ugreen) | Inconsistent; only usable as a hint. |

**Attributes**
| Field | Source | Notes |
|---|---|---|
| RAM | HTML spec table row "RAM"; option label | S25 FE option label "8GB/256GB". |
| storage | HTML option label (the selected variant); spec row "Internal Storage" | **The spec row can list every size** ("256GB, 512GB", "256GB/ 512GB"), so use the option label. |
| variant | HTML option radio groups (`input[name^="option["]`, label from the `title` attribute) | Seen: storage, region ("SG/AUS/TH (Nano Sim + e-Sim)") and colour (Black / Mist Blue / Sage). No option carries price data in the HTML. **[unverified]** whether choosing an option changes the price. |

**Offer**
| Field | Source | Notes |
|---|---|---|
| price | microdata `Offer [itemprop=price]`; info table `<ins>` / "Price" | iPhone 17: 150000.0000, which is the displayed sale price. |
| regular price | Open Graph `product:price:amount`; info table "Regular Price" / `<del>` | iPhone 17: 179999.0000. On a discounted item **og ≠ microdata**. |
| discount | derived as regular minus sale; search card "Save: N৳" | Not a separate field on the product page. |
| currency | microdata `priceCurrency`; `product:price:currency` | Always `BDT` (observed). Display strings use `৳` and comma grouping. |
| availability | info table "Status"; `product:availability` | Text values seen: "In Stock", "Out Of Stock", "Up Coming". Microdata `availability` is `http://schema.org/InStock` when in stock and **empty otherwise**. "Pre Order" was not observed. |
| seller | implicit: Star Tech | Star Tech is a single retailer, not a marketplace, and has no seller field. |
| warranty | HTML spec row "Warranty" (free text) | Examples: "1-year official warranty (… Samsung Service Center)", "BTRC Approved (One-year Apple warranty …)". |
| condition | `product:condition`; microdata `itemCondition` | `new` everywhere it was checked. |

**Media and links**
| Field | Source | Notes |
|---|---|---|
| image | `og:image` (1200×630 webp); microdata `image`; search card 228×228 webp | |
| URL | `<link rel="canonical">` | |

**Price traps [observed]:**
- **Up Coming (S25 Edge):** the page shows "To be announced", but microdata `price=0.0000` and `product:price:amount=0.0000`. A 0 must be treated as "no price".
- **Out Of Stock (PB572):** the page shows "To be announced", but microdata `price=4600.0000` and Open Graph `5800.0000`. These are **stale prices for an item that can't be bought**.
- **Rule:** use a numeric price only when Status is "In Stock" and the price is greater than 0. Otherwise the price is `null`.

## Recommended adapter strategy (Phase 4)

**Product-page extraction (decided by the evidence):**
- Fetch the product page with a plain server-side GET using the shared fetch helper: fixed host allowlist, timeout, size cap above about 430 KB (for example 1.5 MB), and no cookies kept.
- Parse it with cheerio, in this order:
  1. Scoped Product microdata (`sku`, `name`, Offer `price`, `priceCurrency`).
  2. Open Graph `product:*` tags (brand, regular price, availability text, retailer item ID, condition).
  3. The info table (Status, Price/Regular Price, Product Code) to cross-check.
  4. The key-features `Model:` line, the spec table (RAM, Storage, Warranty) and option groups (variant labels).
- Apply the price traps above.
- Save fixtures for the four page types: in stock with discount, in stock without discount, Up Coming, Out Of Stock.

**Finding candidates.** The search page is the obvious route, but `robots.txt` disallows it. Options:
1. **Sitemap-based discovery (compliant; recommended if Star Tech stays first).**
   - `sitemap.xml` [observed] is one 4.36 MB file with 27,415 URLs: categories and products mixed together, no `lastmod`.
   - Fetch it at most about once a day and keep a slim slug index in Vercel's data cache. **[unverified]** whether Vercel's per-item cache size limit fits; this needs checking.
   - Match query tokens against slugs, then fetch the top 5 or fewer product pages in parallel.
   - Costs: matching on slugs is approximate, new products stay invisible until the next refresh, and category URLs have to be filtered out.
2. **Fetch `/product/search` on demand, once per user search.** This is technically simple, but it goes against `robots.txt` and the project rule to respect robots policies. Not recommended unless you explicitly decide otherwise.
3. **Pick a different first store** whose robots rules allow search, and use Star Tech later through option 1.

## Limitations

- The search path is disallowed by `robots.txt`.
- Search relevance is poor: accessories crowd out phones.
- No JSON-LD and no GTIN, EAN or UPC anywhere.
- The SKU is internal to Star Tech.
- The model appears only as free text.
- The storage spec row can list several sizes, so it isn't specific to a variant.
- How option-level prices work is unknown: no price data is attached to options in the HTML.
- Microdata availability is empty unless the item is in stock.
- Out Of Stock and Up Coming pages carry stale or zero prices.
- Product pages are heavy (about 430 KB each) and uncacheable (`no-store`), so keep the number of page fetches per search small.
- Behind Cloudflare: no challenge was seen from a GitHub datacenter IP, but **[unverified]** from Vercel `iad1`. If Vercel requests are challenged or blocked, report the store as `blocked`. No bypass.
- No rate-limit headers were seen; that doesn't mean there are no limits. Keep requests few and sequential where possible.

## Matching implications

- **Usable identity:** brand (reliable) and the model line (free text, normalize it). Variant attributes come from option labels: RAM/storage ("8GB/256GB"), colour, and region/SIM ("SG/AUS/TH").
- **No cross-store identifier.** The internal ID only matches against Star Tech itself. With no GTIN, matching must rely on brand, model and RAM/storage, conservatively.
- **One page covers several variants.** A single product page can cover several colours or regions. Treat the page price as belonging to the variant selected by default only. **[unverified]** whether other options are priced differently.
- **Official vs unofficial.** Region options and the warranty text ("official warranty", "BTRC Approved", "SG/AUS/TH") are the only signals that tell an official Bangladesh unit from an imported one. Keep them as separate attributes; don't normalize them away.
- **Model families.** "Galaxy S25 FE" and "Galaxy S25 Edge" contain "Galaxy S25". The matcher must treat the suffixes (FE, Edge, Plus, Ultra, Pro, Max) as part of the model.
