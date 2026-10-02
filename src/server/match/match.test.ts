import { describe, expect, it } from "vitest";
import type { Offer } from "@/lib/types";
import { normalizeCandidate } from "../normalize/product";
import type { StoreCandidate } from "../stores/types";
import { matchProducts } from "./match";

// Products are built through the real normalization layer, as the search pipeline does.
let n = 0;
function product(title: string, extra: Partial<StoreCandidate> & { store?: string } = {}): Offer {
  const { store = `store-${++n}`, ...rest } = extra;
  const offer = normalizeCandidate(
    { title, url: `https://${store}.example/p/${n}`, price: 100, regularPrice: null, availability: "in_stock", ...rest },
    { storeId: store, storeName: store },
    "2026-10-02T00:00:00.000Z",
  );
  if (!offer) throw new Error("invalid test product");
  return offer;
}

const verdict = (a: Offer, b: Offer) => matchProducts(a, b).verdict;

describe("household products: same product matches on structured attributes", () => {
  it.each([
    ["Chashi Aromatic Chinigura Rice 1kg", "Chashi Aromatic Chinigura Rice 1 KG", "Chashi"],
    ["Chashi Aromatic Chinigura Rice 1kg", "Chashi Chinigura Aromatic Rice 1000g", "Chashi"],
    ["Lux Soft Touch Soap 100g", "LUX Soft Touch Soap 100 gm", "Lux"],
    ["Sunsilk Black Shine Shampoo 200ml", "Sunsilk Black Shine Shampoo 200 ml", "Sunsilk"],
    ["Bashundhara Facial Tissue 100 Sheets", "Bashundhara Facial Tissue 100 sheets", "Bashundhara"],
  ])("%s <-> %s", (a, b, brand) => {
    const result = matchProducts(product(a, { brand }), product(b, { brand }));
    expect(result).toEqual({ verdict: "match", basis: "attributes", reasons: [] });
  });
});

describe("household products: hard mismatches", () => {
  const pairs: [string, string, string][] = [
    ["Rice 1kg vs 2kg", "Chashi Chinigura Rice 1kg", "Chashi Chinigura Rice 2kg"],
    ["500g vs 1kg", "Chashi Chinigura Rice 500g", "Chashi Chinigura Rice 1kg"],
    ["250ml vs 1L", "Pran Mango Juice 250ml", "Pran Mango Juice 1L"],
    ["Soap 100g vs 3 x 100g", "Lux Soft Touch Soap 100g", "Lux Soft Touch Soap 3 x 100g"],
    ["1 piece vs 3 pieces", "Lux Soft Touch Soap 1 pc", "Lux Soft Touch Soap 3 pcs"],
    ["2-pack vs 6-pack", "Bashundhara Tissue 2-pack", "Bashundhara Tissue 6-pack"],
    ["Shampoo 200ml vs 400ml", "Sunsilk Black Shine Shampoo 200ml", "Sunsilk Black Shine Shampoo 400ml"],
    ["Tissue 100 vs 200 sheets", "Bashundhara Facial Tissue 100 Sheets", "Bashundhara Facial Tissue 200 Sheets"],
    ["12 vs 8 pieces", "Mr. Noodles Magic Masala 12 pcs pack", "Mr. Noodles Magic Masala 8 pcs pack"],
    ["bundle vs standalone", "Fresh Rice Bran Oil - 5ltr", "Fresh Rice Bran Oil - 5ltr 4 Pcs Bundle"],
    ["buy-1-get-1 vs single", "Himalaya Shampoo 180ml", "Himalaya Shampoo 180ml (Buy1 Get1 Free)"],
    ["flavour", "Mr. Noodles Masala Flavor 62g", "Mr. Noodles Chicken Flavor 62g"],
    ["scent", "Lux Soap Rose Scent 100g", "Lux Soap Jasmine Scent 100g"],
    ["g vs ml", "Honey 500g", "Honey 500ml"],
  ];
  it.each(pairs)("%s", (_label, a, b) => {
    const brand = a.split(" ")[0];
    expect(verdict(product(a, { brand }), product(b, { brand }))).toBe("no_match");
  });

  it("different brands never match, even with identical names otherwise", () => {
    const r = matchProducts(product("Soybean Oil 5L", { brand: "Fresh" }), product("Soybean Oil 5L", { brand: "Teer" }));
    expect(r.verdict).toBe("no_match");
    expect(r.reasons).toContain("brand differs");
  });
});

describe("missing or incomplete data is never treated as equality", () => {
  it("missing quantity on one side", () => {
    expect(verdict(product("Chashi Rice 1kg", { brand: "Chashi" }), product("Chashi Rice", { brand: "Chashi" }))).toBe("uncertain");
  });

  it("missing quantity on both sides", () => {
    expect(verdict(product("Chashi Rice", { brand: "Chashi" }), product("Chashi Rice", { brand: "Chashi" }))).toBe("uncertain");
  });

  it("missing brand", () => {
    const r = matchProducts(product("Chashi Rice 1kg", { brand: "Chashi" }), product("Chashi Rice 1kg"));
    expect(r).toMatchObject({ verdict: "uncertain", reasons: ["brand missing"] });
    expect(verdict(product("Chashi Rice 1kg"), product("Chashi Rice 1kg"))).toBe("uncertain");
  });

  it("multipack stated on one side only", () => {
    expect(verdict(product("Lux Soap 3 pcs", { brand: "Lux" }), product("Lux Soap", { brand: "Lux" }))).toBe("uncertain");
  });

  it("variant stated on one side only", () => {
    expect(verdict(product("Mr. Noodles Masala Flavor 62g", { brand: "Mr. Noodles" }), product("Mr. Noodles Masala 62g", { brand: "Mr. Noodles" }))).toBe("uncertain");
  });

  it("missing SKU/GTIN/model falls back to attributes, which must all agree", () => {
    const a = product("Fresh Fortified Soyebean Oil - 5ltr", { brand: "Fresh" });
    const b = product("Fresh Soybean Oil 5L", { brand: "Fresh" });
    expect(matchProducts(a, b)).toMatchObject({ verdict: "uncertain", reasons: ["product names describe different or unclear products"] });
  });

  it("identical titles alone are not enough", () => {
    expect(verdict(product("Premium Oil"), product("Premium Oil"))).toBe("uncertain");
  });
});

describe("identifiers", () => {
  it("same store + same store product ID is the same listing", () => {
    const a = product("Fresh Oil 5L", { store: "othoba", storeProductId: "709817" });
    const b = product("Fresh Fortified Soyebean Oil 5ltr", { store: "othoba", storeProductId: "709817" });
    expect(matchProducts(a, b)).toEqual({ verdict: "match", basis: "same_listing", reasons: [] });
  });

  it("store product IDs from different stores are not comparable", () => {
    const a = product("Fresh Oil 5L", { store: "othoba", storeProductId: "709817" });
    const b = product("Fresh Oil 5L", { store: "other", storeProductId: "709817" });
    expect(verdict(a, b)).toBe("uncertain");
  });

  it("same GTIN matches; different GTIN never matches", () => {
    expect(matchProducts(product("Lux Soap 100g", { gtin: "4006381333931" }), product("LUX Bar 100g", { gtin: "4006381333931" }))).toMatchObject({
      verdict: "match",
      basis: "gtin",
    });
    expect(verdict(product("Lux Soap 100g", { gtin: "4006381333931", brand: "Lux" }), product("Lux Soap 100g", { gtin: "036000291452", brand: "Lux" }))).toBe("no_match");
  });

  it("hard conflicts override a shared identifier", () => {
    expect(verdict(product("Lux Soap 100g", { gtin: "4006381333931" }), product("Lux Soap 3 x 100g", { gtin: "4006381333931" }))).toBe("no_match");
  });

  it("same model + same brand matches; different model never matches", () => {
    expect(matchProducts(product("Samsung Galaxy A15", { brand: "Samsung", model: "SM-A155F" }), product("Galaxy A15 Phone", { brand: "SAMSUNG", model: "sm-a155f" }))).toMatchObject({
      verdict: "match",
      basis: "model",
    });
    expect(verdict(product("Phone X", { brand: "Acme", model: "Model X" }), product("Phone X", { brand: "Acme", model: "Model Y" }))).toBe("no_match");
    expect(verdict(product("Phone", { model: "SM-A155F" }), product("Phone", { model: "SM-A155F" }))).toBe("uncertain");
  });
});

describe("electronics attributes", () => {
  const s = { brand: "Samsung" };
  it.each([
    ["RAM/storage", "Samsung Galaxy A15 8GB/128GB", "Samsung Galaxy A15 12GB/256GB"],
    ["storage", "Apple iPhone 16 128GB", "Apple iPhone 16 256GB"],
    ["model line", "Samsung Galaxy S25 256GB", "Samsung Galaxy S25 Ultra 256GB"],
    ["model code", "Samsung Galaxy S24 256GB", "Samsung Galaxy S25 256GB"],
    ["generation", "Samsung Buds (2nd Gen)", "Samsung Buds (3rd Gen)"],
    ["new vs used", "Samsung Galaxy A15 8GB/128GB", "Used Samsung Galaxy A15 8GB/128GB"],
  ])("%s differs -> no_match", (_label, a, b) => {
    expect(verdict(product(a, s), product(b, s))).toBe("no_match");
  });

  it("identical device attributes match without a weight/volume", () => {
    expect(verdict(product("Samsung Galaxy A15 8GB/128GB", s), product("SAMSUNG Galaxy A15 8GB / 128GB", s))).toBe("match");
  });

  it("capacity or generation stated on one side only is uncertain", () => {
    expect(verdict(product("Samsung Galaxy A15 8GB/128GB", s), product("Samsung Galaxy A15", s))).toBe("uncertain");
    expect(verdict(product("Samsung Buds (2nd Gen)", s), product("Samsung Buds", s))).toBe("uncertain");
  });
});
