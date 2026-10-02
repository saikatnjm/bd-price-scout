import { describe, expect, it } from "vitest";
import { parseVariant } from "./variant";

describe("parseVariant", () => {
  it("extracts explicitly stated flavour, scent and colour", () => {
    expect(parseVariant("Mr. Noodles Magic Masala Flavor 12 pcs")).toEqual({ flavour: "Masala" });
    expect(parseVariant("Chips (Flavour: Tomato)")).toEqual({ flavour: "Tomato" });
    expect(parseVariant("Lux Soap Rose Scent 100g")).toEqual({ scent: "Rose" });
    expect(parseVariant("Storage Box Colour: White")).toEqual({ colour: "White" });
  });

  it("keeps different flavours different", () => {
    expect(parseVariant("Noodles Masala Flavor")).not.toEqual(parseVariant("Noodles Chicken Flavor"));
  });

  it("does not attach neighbouring words", () => {
    expect(parseVariant("Mr. Noodles Ramen Carbonara Flavor 85gm")).toEqual({ flavour: "Carbonara" });
  });

  it("does not guess implicit variants", () => {
    expect(parseVariant("Drinko Float 250 ml (Litchi)")).toBeUndefined();
    expect(parseVariant("Fresh Soybean Oil 5L")).toBeUndefined();
  });
});
