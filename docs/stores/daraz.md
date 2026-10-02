# Store research: Daraz (daraz.com.bd)

Researched 2026-10-02 (Phase 7). **Stopped at the terms check:** no automated or server-side requests were made. Only `robots.txt`, the home page and the terms page were viewed in a normal browser.

## 1. Store selected

- **Name:** Daraz, the Alibaba/Lazada group marketplace
- **Domain:** `https://www.daraz.com.bd`
- **Why:** it is the only remaining target on the list. Othoba is already integrated; Shwapno is excluded by its terms (`docs/stores/shwapno.md`); Meena Bazar serves data only through a private API (`docs/stores/othoba.md`, "Store selection").

## Terms of use [observed]

Source: the footer link "Terms & Conditions" (`pages.daraz.com.bd/.../customer-tc`), viewed 2026-10-02.

> "We grant you a limited license to access and make personal use of this Site, but not to download (excluding page caches) or modify the Site or any portion of it in any manner. This license does not include any resale or commercial use of this Site or its contents; **any collection and use of any product listings, descriptions, or prices**; any derivative use of this Site or its contents; any downloading or copying of account information for the benefit of another seller; or **any use of data mining, robots, or similar data gathering and extraction tools**."

This directly excludes what an adapter does: collecting listings and prices with an automated tool.

## robots.txt [observed]

```
User-agent: *
Disallow: /checkout/  /customer/  /cart/  /*index.scss  /*reqwest/index  /wangpu/
Disallow: /shop/*.htm  /catalog/  /*from=  /wow/gcp/  /wow/camp/
```

`/catalog/` is Daraz's search path (`/catalog/?q=…`), so search is disallowed for crawlers.

## 2–6. Search, product pages, fields, household data, model comparison

**Not researched.** The terms prohibit automated collection of listings and prices, so a technical evaluation would serve no permitted purpose. One thing was visible on the home page in normal browsing: product URLs follow `/products/<slug>-i<itemId>-s<skuId>.html`, and listings include multipacks and bundles in their names, e.g. "Shampoo + Conditioner 200ml (Buy 1 Get 1)".

## 7. Recommended adapter strategy

**None. Do not build a Daraz adapter.**

## 8. Limitations / risks

- The terms prohibit collecting listings and prices and using robots or extraction tools.
- `robots.txt` disallows search.
- **[unverified, not tested]** Daraz is widely known for bot protection. It was deliberately not probed.

## 9. Phase 8 recommendation

Don't implement a Daraz adapter. None of the four target stores can be added as a second store under the project rules:

| Store | Reason |
|---|---|
| Othoba | Already integrated |
| Shwapno | Terms prohibit automated access and scraping |
| Daraz | Terms prohibit collecting listings and prices and using robots |
| Meena Bazar | Data only through a private, undocumented API |

**Options for a second store** (your decision):
1. **Another grocery or household store.** Screen terms and `robots.txt` first, as was done for Othoba. Candidates: Chaldal, Unimart and other online supermarkets.
2. **Ask a store for permission or an official feed or API.** Daraz, Shwapno and Meena Bazar would all become possible with written permission or a sanctioned data source.
3. **Star Tech** (already researched in `docs/stores/startech.md`): no anti-scraping terms were found and product pages are allowed. It sells electronics, not household goods.
