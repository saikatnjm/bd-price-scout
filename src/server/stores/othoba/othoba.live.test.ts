import { describe, expect, it } from "vitest";
import { othobaAdapter } from "./adapter";

// Live check against the real store. Skipped unless LIVE_STORE_TESTS=1
// (run manually via the "Live store check" workflow, never in normal CI).
describe.runIf(process.env.LIVE_STORE_TESTS === "1")("othoba live", () => {
  it("returns real, well-formed products for representative household queries", { timeout: 90_000 }, async () => {
    const queries = ["soybean oil 5 ltr", "rice", "shampoo", "detergent", "noodles masala"];
    for (const query of queries) {
      const started = Date.now();
      const results = await othobaAdapter.search(query, { signal: AbortSignal.timeout(15_000) });
      console.log(
        `LIVE ${JSON.stringify(query)} ${Date.now() - started}ms n=${results.length} ` +
          results.map((r) => `[${r.title.slice(0, 40)} | ${r.price}/${r.regularPrice} | ${r.availability}]`).join(" "),
      );
      for (const r of results) {
        expect(r.url).toMatch(/^https:\/\/othoba\.com\//);
        if (r.price !== null) expect(r.price).toBeGreaterThan(0);
      }
      if (query === "soybean oil 5 ltr") expect(results.length).toBeGreaterThan(0);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  });
});
