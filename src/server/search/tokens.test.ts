import { describe, expect, it } from "vitest";
import { queryTokens, tokenize } from "./tokens";

describe("tokenize", () => {
  it("splits numbers from units and unifies unit spellings only", () => {
    expect(tokenize("Fresh Soyebean Oil - 5ltr")).toEqual(["fresh", "soyebean", "oil", "5", "l"]);
    expect(tokenize("62gm x 12pcs")).toEqual(["62", "g", "x", "12", "pcs"]);
    expect(tokenize("1.5 Litre")).toEqual(["1.5", "l"]);
  });

  it("keeps different units and amounts distinct", () => {
    expect(tokenize("500g")).not.toEqual(tokenize("1kg"));
    expect(tokenize("250 ml")).not.toEqual(tokenize("1 l"));
  });
});

describe("queryTokens", () => {
  it("drops stopwords and duplicates", () => {
    expect(queryTokens("the soybean oil and oil 5L")).toEqual(["soybean", "oil", "5", "l"]);
  });
});
