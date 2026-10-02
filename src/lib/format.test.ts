import { describe, expect, it } from "vitest";
import { formatBdt, isSafeHttpUrl } from "./format";

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
