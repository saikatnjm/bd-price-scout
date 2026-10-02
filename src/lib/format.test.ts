import { describe, expect, it } from "vitest";
import { formatBdt, formatPack, isSafeHttpUrl } from "./format";

describe("formatBdt", () => {
  it("uses lakh grouping", () => {
    expect(formatBdt(125000)).toBe("৳1,25,000");
    expect(formatBdt(999)).toBe("৳999");
  });
});

describe("isSafeHttpUrl", () => {
  it("accepts http(s) and rejects other schemes or garbage", () => {
    expect(isSafeHttpUrl("https://www.example.com/p/1")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,hi")).toBe(false);
    expect(isSafeHttpUrl("/relative")).toBe(false);
  });
});

describe("formatPack", () => {
  it("summarises known package info only", () => {
    expect(formatPack({ size: { value: 5, unit: "l" }, multipack: false, bundle: false })).toBe("5 L");
    expect(formatPack({ size: { value: 62, unit: "g" }, count: 12, multipack: true, bundle: false })).toBe("12 × 62 g");
    expect(formatPack({ count: 3, multipack: true, bundle: false })).toBe("3 pcs");
    expect(formatPack({ size: { value: 5, unit: "l" }, count: 4, multipack: true, bundle: true })).toBe("4 × 5 L · Bundle");
    expect(formatPack({ multipack: false, bundle: false })).toBeUndefined();
    expect(formatPack(undefined)).toBeUndefined();
  });
});
