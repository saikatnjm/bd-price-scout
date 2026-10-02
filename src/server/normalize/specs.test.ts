import { describe, expect, it } from "vitest";
import { parseSpecs } from "./specs";

describe("parseSpecs", () => {
  it("reads explicit RAM and storage", () => {
    expect(parseSpecs("Samsung Galaxy A15 8GB/128GB")).toMatchObject({ ramGb: 8, storageGb: 128, capacitiesGb: [8, 128] });
    expect(parseSpecs("Phone 12GB RAM 256GB ROM")).toMatchObject({ ramGb: 12, storageGb: 256 });
    expect(parseSpecs("Laptop 16GB DDR5 1TB SSD")).toMatchObject({ ramGb: 16, storageGb: 1024 });
  });

  it("does not assign a role to an unlabelled capacity", () => {
    const s = parseSpecs("iPhone 16 128GB");
    expect(s.capacitiesGb).toEqual([128]);
    expect(s.ramGb).toBeUndefined();
    expect(s.storageGb).toBeUndefined();
  });

  it("reads generation, used condition, model codes and qualifiers", () => {
    expect(parseSpecs("AirPods Pro (2nd Generation)")).toMatchObject({ generation: 2, qualifiers: ["pro"] });
    expect(parseSpecs("Echo Dot Gen 5").generation).toBe(5);
    expect(parseSpecs("Used iPhone 13").used).toBe(true);
    expect(parseSpecs("Galaxy S25 Ultra 5G")).toMatchObject({ modelCodes: ["s25"], qualifiers: ["ultra"] });
    expect(parseSpecs("Ugreen PB572 10000mAh Power Bank").modelCodes).toEqual(["pb572"]);
  });

  it("does not mistake units or pack notation for model codes", () => {
    expect(parseSpecs("Mr. Noodles 12 pcs Family Pack (62gm x 12pcs)").modelCodes).toEqual([]);
    expect(parseSpecs("Seylon Tea 3in1 10X15g 150g").modelCodes).toEqual([]);
    expect(parseSpecs("Fresh Soyebean Oil - 5ltr").modelCodes).toEqual([]);
    expect(parseSpecs("Shampoo 180ml B1G1").modelCodes).toEqual([]);
  });
});
