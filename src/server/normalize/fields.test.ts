import { describe, expect, it } from "vitest";
import { normalizeAmount, normalizeAvailability, normalizeBrand, normalizeGtin, normalizePrice, normalizeUrl } from "./fields";

describe("normalizeBrand", () => {
  it("trims, keeps casing, drops placeholders", () => {
    expect(normalizeBrand("  Mr.  Noodles ")).toBe("Mr. Noodles");
    expect(normalizeBrand("Fresh")).not.toBe(normalizeBrand("Teer"));
    expect(normalizeBrand("")).toBeUndefined();
    expect(normalizeBrand("N/A")).toBeUndefined();
    expect(normalizeBrand("Others")).toBeUndefined(); // observed live on Othoba
    expect(normalizeBrand(42)).toBeUndefined();
  });
});

describe("normalizeGtin", () => {
  it("keeps valid GTINs and rejects invalid ones without repairing", () => {
    expect(normalizeGtin("4006381333931")).toBe("4006381333931"); // EAN-13
    expect(normalizeGtin("036000291452")).toBe("036000291452"); // UPC-A
    expect(normalizeGtin("4006-3813-3393-1")).toBe("4006381333931");
    expect(normalizeGtin("4006381333932")).toBeUndefined(); // bad check digit
    expect(normalizeGtin("709817")).toBeUndefined(); // store ID, not a GTIN
    expect(normalizeGtin(undefined)).toBeUndefined();
  });
});

describe("prices", () => {
  it("parses numeric and formatted amounts", () => {
    expect(normalizeAmount(990)).toBe(990);
    expect(normalizeAmount("1,000.00")).toBe(1000);
    expect(normalizeAmount("৳ 1,25,000")).toBe(125000);
    expect(normalizeAmount("Tk 265")).toBe(265);
    expect(normalizeAmount("12.345")).toBe(12.35);
  });

  it("rejects invalid, zero or missing amounts", () => {
    for (const v of [null, undefined, "", "free", 0, -5, NaN, Infinity, "0.00"]) expect(normalizeAmount(v)).toBeNull();
  });

  it("keeps original + current with a discount only when original is higher", () => {
    expect(normalizePrice(990, 1000)).toEqual({ price: 990, regularPrice: 1000, discount: { amount: 10, percent: 1 } });
    expect(normalizePrice(3940, 4620)).toMatchObject({ discount: { amount: 680, percent: 14.7 } });
  });

  it("never derives a discount from incomplete or inconsistent data", () => {
    expect(normalizePrice(265, null)).toEqual({ price: 265, regularPrice: null });
    expect(normalizePrice(1000, 1000)).toEqual({ price: 1000, regularPrice: null });
    expect(normalizePrice(1000, 900)).toEqual({ price: 1000, regularPrice: null });
    expect(normalizePrice(null, 1000)).toEqual({ price: null, regularPrice: null });
  });
});

describe("normalizeAvailability", () => {
  it("maps clear values only", () => {
    expect(normalizeAvailability("http://schema.org/InStock")).toBe("in_stock");
    expect(normalizeAvailability("https://schema.org/OutOfStock")).toBe("out_of_stock");
    expect(normalizeAvailability("SoldOut")).toBe("out_of_stock");
    expect(normalizeAvailability("PreOrder")).toBe("preorder");
    expect(normalizeAvailability("in_stock")).toBe("in_stock");
  });

  it("treats missing or unclear values as unknown, never out of stock", () => {
    expect(normalizeAvailability(undefined)).toBe("unknown");
    expect(normalizeAvailability("")).toBe("unknown");
    expect(normalizeAvailability("Discontinued")).toBe("unknown");
    expect(normalizeAvailability("call for price")).toBe("unknown");
  });
});

describe("normalizeUrl", () => {
  it("removes fragments and tracking params only", () => {
    expect(normalizeUrl("https://othoba.com/p?utm_source=x&pagenumber=2#reviews")).toBe("https://othoba.com/p?pagenumber=2");
    expect(normalizeUrl("https://othoba.com/p")).toBe("https://othoba.com/p");
  });

  it("rejects unsafe or invalid URLs", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeUrl("https://u:p@othoba.com/")).toBeUndefined();
    expect(normalizeUrl("/relative")).toBeUndefined();
    expect(normalizeUrl("http://img.example/a.jpg", { httpsOnly: true })).toBeUndefined();
  });
});
