import { describe, expect, it } from "vitest";
import { othobaAdapter } from "./adapter";

// Live check against the real store. Skipped unless LIVE_STORE_TESTS=1
// (run manually via the "Live store check" workflow, never in normal CI).
describe.runIf(process.env.LIVE_STORE_TESTS === "1")("othoba live", () => {
  it("returns real, well-formed products for a grocery query", { timeout: 30_000 }, async () => {
    const results = await othobaAdapter.search("soybean oil 5 ltr", { signal: AbortSignal.timeout(25_000) });
    console.log(JSON.stringify(results, null, 2));
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.url).toMatch(/^https:\/\/othoba\.com\//);
      expect(r.title.toLowerCase()).toContain("oil");
      if (r.price !== null) expect(r.price).toBeGreaterThan(0);
    }
  });
});
