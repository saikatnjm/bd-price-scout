import { describe, expect, it } from "vitest";
import type { Offer } from "@/lib/types";
import { normalizeCandidate } from "../normalize/product";
import type { StoreCandidate } from "../stores/types";
import { groupOffers } from "./group";

// Deterministic multi-store test data built through the real normalization layer.
// These are test fixtures only; no production store adapter is involved.
let seq = 0;
function offer(store: string, title: string, extra: Partial<StoreCandidate> = {}): Offer {
  const o = normalizeCandidate(
    { title, url: `https://${store}.example/p/${++seq}`, price: 100, regularPrice: null, availability: "in_stock", ...extra },
    { storeId: store, storeName: store.toUpperCase() },
    "2026-10-02T00:00:00.000Z",
  );
  if (!o) throw new Error("invalid fixture");
  return o;
}

describe("groupOffers", () => {
  it("one store: each product is its own group, no lowest price", () => {
    const offers = [
      offer("othoba", "Fresh Soybean Oil 5L", { brand: "Fresh", price: 990 }),
      offer("othoba", "Teer Soybean Oil 5L", { brand: "Teer", price: 1000 }),
    ];
    const groups = groupOffers(offers);
    expect(groups).toHaveLength(2);
    for (const g of groups) {
      expect(g.storeCount).toBe(1);
      expect(g.lowestPrice).toBeUndefined();
      expect(g.matchBasis).toBeUndefined();
    }
  });

  it("multiple products with no matches stay separate, in their original order", () => {
    const offers = [
      offer("a", "Chashi Rice 1kg", { brand: "Chashi" }),
      offer("b", "Pran Juice 250ml", { brand: "Pran" }),
      offer("a", "Lux Soap 100g", { brand: "Lux" }),
    ];
    expect(groupOffers(offers).map((g) => g.title)).toEqual(["Chashi Rice 1kg", "Pran Juice 250ml", "Lux Soap 100g"]);
  });

  it("the same normalized product at two stores forms one group with both prices kept", () => {
    const a = offer("a", "Lux Soft Touch Soap 100g", { brand: "Lux", price: 60, imageUrl: "https://img.a.example/lux.webp" });
    const b = offer("b", "LUX Soft Touch Soap 100 gm", { brand: "Lux", price: 55 });
    const [group, ...rest] = groupOffers([a, b]);
    expect(rest).toHaveLength(0);
    expect(group).toMatchObject({
      title: "Lux Soft Touch Soap 100g",
      storeCount: 2,
      matchBasis: "attributes",
      lowestPrice: 55,
      imageUrl: "https://img.a.example/lux.webp",
      pack: { size: { value: 100, unit: "g" } },
    });
    expect(group?.offers.map((o) => [o.storeId, o.price, o.url])).toEqual([
      ["a", 60, a.url],
      ["b", 55, b.url],
    ]);
  });

  it("a confirmed GTIN match creates one group even with different names", () => {
    const groups = groupOffers([
      offer("a", "Lux Soap 100g", { gtin: "4006381333931" }),
      offer("b", "LUX Beauty Bar 100g", { gtin: "4006381333931" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.matchBasis).toBe("gtin");
  });

  it("different package sizes remain separate", () => {
    const groups = groupOffers([
      offer("a", "Chashi Chinigura Rice 500g", { brand: "Chashi", price: 80 }),
      offer("b", "Chashi Chinigura Rice 1kg", { brand: "Chashi", price: 150 }),
      offer("b", "Chashi Chinigura Rice 1kg 2 Pcs Bundle", { brand: "Chashi", price: 290 }),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.lowestPrice === undefined)).toBe(true);
  });

  it("different variants remain separate", () => {
    const groups = groupOffers([
      offer("a", "Mr. Noodles Masala Flavor 62g", { brand: "Mr. Noodles" }),
      offer("b", "Mr. Noodles Chicken Flavor 62g", { brand: "Mr. Noodles" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("uncertain pairs (e.g. missing brand) do not create a comparison group", () => {
    const groups = groupOffers([offer("a", "Lux Soft Touch Soap 100g", { brand: "Lux" }), offer("b", "Lux Soft Touch Soap 100g")]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.storeCount === 1)).toBe(true);
  });

  it("an offer joins a group only if it matches every member (no chaining)", () => {
    // b matches a; c (no GTIN, different name) is uncertain against a and b, so it stays out.
    const a = offer("a", "Lux Soap 100g", { gtin: "4006381333931", brand: "Lux" });
    const b = offer("b", "LUX Beauty Bar 100g", { gtin: "4006381333931", brand: "Lux" });
    const c = offer("c", "LUX Beauty Bar 100g", { brand: "Lux" });
    const groups = groupOffers([a, b, c]);
    expect(groups.map((g) => g.offers.length)).toEqual([2, 1]);
  });

  it("missing price and availability are kept without crashing or a lowest price", () => {
    const groups = groupOffers([
      offer("a", "Lux Soft Touch Soap 100g", { brand: "Lux", price: null, availability: "unknown" }),
      offer("b", "Lux Soft Touch Soap 100g", { brand: "Lux", price: 55 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.offers.map((o) => [o.price, o.availability])).toEqual([
      [null, "unknown"],
      [55, "in_stock"],
    ]);
    expect(groups[0]?.lowestPrice).toBeUndefined(); // only one store has an in-stock price
  });

  it("out-of-stock offers never set the lowest price", () => {
    const groups = groupOffers([
      offer("a", "Lux Soft Touch Soap 100g", { brand: "Lux", price: 40, availability: "out_of_stock" }),
      offer("b", "Lux Soft Touch Soap 100g", { brand: "Lux", price: 60 }),
      offer("c", "Lux Soft Touch Soap 100g", { brand: "Lux", price: 55 }),
    ]);
    expect(groups[0]?.lowestPrice).toBe(55);
  });

  it("missing image leaves the group image absent; links stay per offer", () => {
    const groups = groupOffers([offer("a", "Pran Juice 250ml", { brand: "Pran" })]);
    expect(groups[0]).not.toHaveProperty("imageUrl");
    expect(groups[0]?.offers[0]?.url).toMatch(/^https:\/\/a\.example\/p\/\d+$/);
  });

  it("returns no groups for no offers", () => {
    expect(groupOffers([])).toEqual([]);
  });
});
