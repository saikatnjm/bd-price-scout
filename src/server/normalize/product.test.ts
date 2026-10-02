import { describe, expect, it } from "vitest";
import type { StoreCandidate } from "../stores/types";
import { normalizeCandidate } from "./product";

const store = { storeId: "othoba", storeName: "Othoba" };
const at = "2026-10-02T00:00:00.000Z";
const candidate = (overrides: Partial<StoreCandidate> = {}): StoreCandidate => ({
  title: "Fresh Fortified Soyebean Oil  - 5ltr",
  url: "https://othoba.com/fresh-oil-709817",
  price: 990,
  regularPrice: 1000,
  availability: "in_stock",
  ...overrides,
});

describe("normalizeCandidate", () => {
  it("maps a full store candidate into the shared shape, keeping identifiers traceable", () => {
    const offer = normalizeCandidate(
      candidate({
        imageUrl: "https://images.othoba.com/a.webp",
        storeProductId: "709817",
        sku: "MGIN709817",
        brand: " Fresh ",
        seller: "Meghna Group of Industries",
        category: "Grocery > Oil",
        gtin: "4006381333931",
        model: " X-100 ",
      }),
      store,
      at,
    );
    expect(offer).toEqual({
      storeId: "othoba",
      storeName: "Othoba",
      title: "Fresh Fortified Soyebean Oil - 5ltr",
      url: "https://othoba.com/fresh-oil-709817",
      price: 990,
      regularPrice: 1000,
      discount: { amount: 10, percent: 1 },
      currency: "BDT",
      availability: "in_stock",
      imageUrl: "https://images.othoba.com/a.webp",
      storeProductId: "709817",
      sku: "MGIN709817",
      brand: "Fresh",
      seller: "Meghna Group of Industries",
      category: "Grocery > Oil",
      gtin: "4006381333931",
      model: "X-100",
      pack: { size: { value: 5, unit: "l" }, multipack: false, bundle: false, total: { value: 5000, unit: "ml" } },
      checkedAt: at,
    });
  });

  it("leaves missing optional fields absent and keeps the product", () => {
    const offer = normalizeCandidate(candidate({ title: "Piyaj Loose Kg", price: null, regularPrice: null, availability: "unknown" }), store, at);
    expect(offer).toMatchObject({ title: "Piyaj Loose Kg", price: null, regularPrice: null, availability: "unknown" });
    for (const key of ["discount", "imageUrl", "storeProductId", "sku", "brand", "seller", "gtin", "model", "variant"]) {
      expect(offer).not.toHaveProperty(key);
    }
    expect(offer?.pack).toEqual({ multipack: false, bundle: false });
  });

  it("drops invalid identifiers and unsafe URLs instead of passing them on", () => {
    const offer = normalizeCandidate(candidate({ gtin: "123", imageUrl: "http://insecure.example/a.jpg", brand: "N/A" }), store, at);
    expect(offer).not.toHaveProperty("gtin");
    expect(offer).not.toHaveProperty("imageUrl");
    expect(offer).not.toHaveProperty("brand");
  });

  it("returns null for candidates that cannot be shown", () => {
    expect(normalizeCandidate(candidate({ title: "   " }), store, at)).toBeNull();
    expect(normalizeCandidate(candidate({ url: "javascript:alert(1)" }), store, at)).toBeNull();
  });

  it("preserves meaningful differences between similar products", () => {
    const n = (title: string) => normalizeCandidate(candidate({ title }), store, at);
    expect(n("Rice 500g")?.pack).not.toEqual(n("Rice 1kg")?.pack);
    expect(n("Oil 5ltr")?.pack).not.toEqual(n("Oil 5ltr 4 Pcs Bundle")?.pack);
    expect(n("Noodles Masala Flavor 62g")?.variant).not.toEqual(n("Noodles Chicken Flavor 62g")?.variant);
    expect(n("Mr. Noodles Magic Masala Flavor 12 pcs Family Pack (62gm x 12pcs)")).toMatchObject({
      title: "Mr. Noodles Magic Masala Flavor 12 pcs Family Pack (62gm x 12pcs)",
      variant: { flavour: "Magic Masala" },
      pack: { count: 12, size: { value: 62, unit: "g" } },
    });
  });
});
