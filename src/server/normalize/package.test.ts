import { describe, expect, it } from "vitest";
import { parsePackage } from "./package";

describe("parsePackage: quantity and unit", () => {
  it.each([
    ["Miniket Rice 500g", { value: 500, unit: "g" }, { value: 500, unit: "g" }],
    ["Daily Shopping Miniket Standard 1kg", { value: 1, unit: "kg" }, { value: 1000, unit: "g" }],
    ["Drinko Float 250 ml (Litchi)", { value: 250, unit: "ml" }, { value: 250, unit: "ml" }],
    ["Fresh Soybean Oil 1L", { value: 1, unit: "l" }, { value: 1000, unit: "ml" }],
    ["Fresh Fortified Soyebean Oil - 5ltr", { value: 5, unit: "l" }, { value: 5000, unit: "ml" }],
    ["Pepsi 1.5 Litre", { value: 1.5, unit: "l" }, { value: 1500, unit: "ml" }],
    ["Himalaya Shampoo 180(±)10ml", { value: 180, unit: "ml" }, { value: 180, unit: "ml" }],
  ])("%s", (name, size, total) => {
    const p = parsePackage(name);
    expect(p.size).toEqual(size);
    expect(p.total).toEqual(total);
    expect(p.count).toBeUndefined();
    expect(p.multipack).toBe(false);
  });

  it("keeps different amounts different (500g vs 1kg, 250ml vs 1L)", () => {
    expect(parsePackage("Rice 500g").total).not.toEqual(parsePackage("Rice 1kg").total);
    expect(parsePackage("Juice 250ml").total).not.toEqual(parsePackage("Juice 1L").total);
    expect(parsePackage("Rice 1000g").total).toEqual(parsePackage("Rice 1kg").total);
  });
});

describe("parsePackage: pieces, multipacks and bundles", () => {
  it("1 piece vs 3 pieces", () => {
    expect(parsePackage("Lux Soap 1 pc")).toMatchObject({ count: 1, multipack: false, total: { value: 1, unit: "piece" } });
    expect(parsePackage("Lux Soap 3 pcs")).toMatchObject({ count: 3, multipack: true, total: { value: 3, unit: "piece" } });
  });

  it("2-pack vs 6-pack vs pack of 6", () => {
    expect(parsePackage("Tissue 2-pack").count).toBe(2);
    expect(parsePackage("Tissue 6-Pack").count).toBe(6);
    expect(parsePackage("Tissue Pack of 6").count).toBe(6);
  });

  it("multipack with per-item size: size first and count first", () => {
    expect(parsePackage("Mr. Noodles Magic Masala Flavor 12 pcs Family Pack (62gm x 12pcs)")).toEqual({
      size: { value: 62, unit: "g" },
      count: 12,
      multipack: true,
      bundle: false,
      total: { value: 744, unit: "g" },
    });
    expect(parsePackage("Seylon Instant Milk Tea 3in1 10X15g 150g")).toMatchObject({
      size: { value: 15, unit: "g" },
      count: 10,
      total: { value: 150, unit: "g" },
    });
  });

  it("flags bundles and keeps them distinct from the single item", () => {
    const single = parsePackage("Fresh Rice Bran Oil - 5ltr");
    const bundle = parsePackage("Fresh Rice Bran Oil - 5ltr 4 Pcs Bundle");
    expect(single).toMatchObject({ bundle: false, multipack: false, total: { value: 5000, unit: "ml" } });
    expect(bundle).toMatchObject({ bundle: true, count: 4, multipack: true, total: { value: 20000, unit: "ml" } });
    expect(parsePackage("Shampoo 180(±)10ml (Buy1 Get1 Free)").bundle).toBe(true);
    expect(parsePackage("Rice Combo Offer").bundle).toBe(true);
  });
});

describe("parsePackage: never guesses", () => {
  it("leaves everything absent when no quantity is stated", () => {
    expect(parsePackage("Piyaj (Onion) Local Loose (P) Kg")).toEqual({ multipack: false, bundle: false });
    expect(parsePackage("")).toEqual({ multipack: false, bundle: false });
  });

  it("drops contradictory sizes or counts instead of picking one", () => {
    expect(parsePackage("Oil 1L 2L").size).toBeUndefined();
    expect(parsePackage("Oil 1L 2L").total).toBeUndefined();
    expect(parsePackage("Soap 3 pcs 4 pcs").count).toBeUndefined();
    expect(parsePackage("Noodles 10 x 15g 200g").size).toBeUndefined();
  });

  it("does not read units out of words or model codes", () => {
    expect(parsePackage("Gold Tea Premium").size).toBeUndefined();
    expect(parsePackage("Detergent 3in1").size).toBeUndefined();
  });
});
