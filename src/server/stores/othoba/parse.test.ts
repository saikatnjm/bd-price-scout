import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../../tests/fixtures";
import { parseCategoryPage, parseProductPage } from "./parse";

const productHtml = (ld: object, microPrice?: string) =>
  `<html><body><script type="application/ld+json">${JSON.stringify(ld)}</script>` +
  (microPrice ? `<span itemprop="price" content="${microPrice}"></span>` : "") +
  `</body></html>`;

const base = {
  "@type": "Product",
  name: "Test Rice 1Kg",
  offers: { "@type": "Offer", priceCurrency: "BDT", price: "120.00", availability: "http://schema.org/InStock" },
};

describe("parseProductPage (real fixtures)", () => {
  it("extracts a discounted product: sale_price is paid, price is regular", () => {
    const p = parseProductPage(loadFixture("othoba/product-discounted"), "https://othoba.com/x");
    expect(p).toEqual({
      title: "Fresh Fortified Soyebean Oil - 5ltr",
      url: "https://othoba.com/fresh-fortified-soyebean-oil-5ltr-meghna-group-of-industries-709817",
      price: 990,
      regularPrice: 1000,
      availability: "in_stock",
      imageUrl: expect.stringMatching(/^https:\/\/images\.othoba\.com\/.+\.webp$/),
      storeProductId: "709817",
      sku: "MGIN709817",
      brand: "Fresh",
      seller: "Meghna Group of Industries",
      category: "Grocery > Oil",
    });
  });

  it("extracts a non-discounted multipack and keeps pack details in the title", () => {
    const p = parseProductPage(loadFixture("othoba/product-multipack"), "https://othoba.com/x");
    expect(p).toMatchObject({
      title: "Mr. Noodles Magic Masala Flavor 12 pcs Family Pack (62gm x 12pcs)",
      price: 265,
      regularPrice: null,
      availability: "in_stock",
      storeProductId: "8374",
      sku: "DS33408",
      brand: "Mr. Noodles",
      seller: "Daily Shopping",
    });
  });

  it("keeps a bundle as its own product with the bundle price", () => {
    const p = parseProductPage(loadFixture("othoba/product-bundle"), "https://othoba.com/x");
    expect(p).toMatchObject({ title: "Fresh Rice Bran Oil - 5ltr 4 Pcs Bundle", price: 3940, regularPrice: 4620 });
  });
});

describe("parseProductPage (edge cases)", () => {
  it("returns null without Product JSON-LD and skips malformed blocks", () => {
    expect(parseProductPage("<html><body>nothing</body></html>", "https://othoba.com/x")).toBeNull();
    const html = `<script type="application/ld+json">{bad json</script>` + productHtml(base);
    expect(parseProductPage(html, "https://othoba.com/x")?.price).toBe(120);
  });

  it("maps availability values and leaves unknown values unknown", () => {
    const withAvail = (a: string) =>
      parseProductPage(productHtml({ ...base, offers: { ...base.offers, availability: a } }), "https://othoba.com/x")
        ?.availability;
    expect(withAvail("http://schema.org/OutOfStock")).toBe("out_of_stock");
    expect(withAvail("https://schema.org/PreOrder")).toBe("preorder");
    expect(withAvail("Something")).toBe("unknown");
  });

  it("never invents a price: missing, zero, non-BDT or contradicting microdata gives null", () => {
    const priced = (offers: object, micro?: string) =>
      parseProductPage(productHtml({ ...base, offers: { ...base.offers, ...offers } }, micro), "https://othoba.com/x");
    expect(priced({ price: "" })?.price).toBeNull();
    expect(priced({ price: "0.00" })?.price).toBeNull();
    expect(priced({ priceCurrency: "USD" })?.price).toBeNull();
    expect(priced({}, "130.00")).toMatchObject({ price: null, regularPrice: null });
    expect(priced({}, "120.00")?.price).toBe(120);
  });

  it("keeps Othoba-hosted images (resolving relative paths) and drops others", () => {
    const img = (image: unknown) => parseProductPage(productHtml({ ...base, image }), "https://othoba.com/x")?.imageUrl;
    expect(img("https://images.othoba.com/images/thumbs/1_a.webp")).toBe("https://images.othoba.com/images/thumbs/1_a.webp");
    expect(img("/images/thumbs/2_b.jpeg")).toBe("https://othoba.com/images/thumbs/2_b.jpeg");
    expect(img(["https://images.othoba.com/images/thumbs/3_c.webp"])).toBe("https://images.othoba.com/images/thumbs/3_c.webp");
    expect(img("https://cdn.evil.example/x.jpg")).toBeUndefined();
    expect(img("http://images.othoba.com/x.jpg")).toBeUndefined();
    expect(img("https://images.othoba.com:8443/x.jpg")).toBeUndefined();
  });

  it("drops a brand that is really the seller's name, but keeps a brand sold by its own store", () => {
    const withBrand = (brand: string, seller: string) =>
      parseProductPage(productHtml({ ...base, brand, offers: { ...base.offers, seller } }), "https://othoba.com/x");
    // Observed live: Dark Fantasy biscuits "Brand: VistaMart  Seller: VistaMart".
    expect(withBrand("VistaMart", "VistaMart")).toMatchObject({ seller: "VistaMart" });
    expect(withBrand("VistaMart", "VistaMart")?.brand).toBeUndefined();
    // Observed live: PRAN rice "Brand: Bango Millers  Seller: Bango Millers Ltd.".
    expect(withBrand("Bango Millers", "Bango Millers Ltd.")?.brand).toBeUndefined();
    // A brand's own store keeps the brand.
    expect(withBrand("Himalaya", "Himalaya Wellness Bangladesh")?.brand).toBe("Himalaya");
    expect(withBrand("PRAN Rice", "Bango Millers Ltd.")?.brand).toBe("PRAN Rice");
  });

  it("leaves missing optional fields absent and rejects foreign URLs", () => {
    const p = parseProductPage(
      productHtml({ ...base, brand: "", sku: "", url: "https://evil.example/p", image: "javascript:x" }),
      "https://othoba.com/fallback",
    );
    expect(p).toMatchObject({ url: "https://othoba.com/fallback" });
    expect(
      parseProductPage(productHtml({ ...base, url: "https://othoba.com:8443/p" }), "https://othoba.com/fallback")?.url,
    ).toBe("https://othoba.com/fallback");
    expect(p?.brand).toBeUndefined();
    expect(p?.sku).toBeUndefined();
    expect(p?.imageUrl).toBeUndefined();
  });
});

describe("parseCategoryPage", () => {
  it("extracts product cards and pagination from a real category page", () => {
    const page = parseCategoryPage(loadFixture("othoba/category-oil"));
    expect(page.cards).toHaveLength(40);
    expect(page.cards).toContainEqual({
      productId: "709817",
      name: "Fresh Fortified Soyebean Oil - 5ltr",
      url: "https://othoba.com/fresh-fortified-soyebean-oil-5ltr-meghna-group-of-industries-709817",
    });
    expect(page.hasNextPage).toBe(true);
  });

  it("skips malformed cards and reports no next page on a single page", () => {
    const html = `<div class="product-wrap" data-productid="1"><h4 class="product-name"><a href="/a">A</a></h4></div>
      <div class="product-wrap" data-productid="x"><h4 class="product-name"><a href="/b">B</a></h4></div>
      <div class="product-wrap" data-productid="3"><h4 class="product-name"><a href="https://evil.example/c">C</a></h4></div>`;
    expect(parseCategoryPage(html)).toEqual({
      cards: [{ productId: "1", name: "A", url: "https://othoba.com/a" }],
      hasNextPage: false,
    });
  });
});
