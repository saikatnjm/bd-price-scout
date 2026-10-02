import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../../../../tests/fixtures";
import { StoreBlockedError, StoreError } from "../types";
import { othobaAdapter } from "./adapter";

const htmlResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

const pages: Record<string, () => Response> = {
  "/oil": () => htmlResponse(loadFixture("othoba/category-oil")),
  "/fresh-fortified-soyebean-oil-5ltr-meghna-group-of-industries-709817": () =>
    htmlResponse(loadFixture("othoba/product-discounted")),
  "/fresh-rice-bran-oil-5ltr-4-pcs-bundle": () => htmlResponse(loadFixture("othoba/product-bundle")),
};

function mockStore(overrides: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn(async (input: URL) => {
    const route = { ...pages, ...overrides }[input.pathname + input.search] ?? { ...pages, ...overrides }[input.pathname];
    // Pages without a fixture answer 404, exercising partial-failure handling.
    return route ? route() : htmlResponse("not found", 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ctx = () => ({ signal: new AbortController().signal });
const requested = (m: ReturnType<typeof mockStore>) => m.mock.calls.map(([u]) => (u as URL).pathname + (u as URL).search);

afterEach(() => vi.unstubAllGlobals());

describe("othobaAdapter.search", () => {
  it("finds products through the category page and extracts them from product pages", async () => {
    const fetchMock = mockStore();
    const results = await othobaAdapter.search("fresh soybean oil 5 ltr", ctx());

    expect(requested(fetchMock)[0]).toBe("/oil");
    expect(results.map((r) => r.storeProductId)).toContain("709817");
    expect(results.find((r) => r.storeProductId === "709817")).toMatchObject({ price: 990, regularPrice: 1000 });
    // Product pages that 404 are tolerated; at most 5 product pages are requested.
    expect(requested(fetchMock).filter((p) => p !== "/oil" && !p.startsWith("/oil?")).length).toBeLessThanOrEqual(5);
  });

  it("keeps the bundle separate from single units", async () => {
    mockStore();
    const results = await othobaAdapter.search("rice bran oil bundle", ctx());
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ title: "Fresh Rice Bran Oil - 5ltr 4 Pcs Bundle", price: 3940 });
  });

  it("returns no results without any request for queries outside supported categories", async () => {
    const fetchMock = mockStore();
    await expect(othobaAdapter.search("iphone 16 128gb", ctx())).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no results when nothing in the category matches every query word", async () => {
    mockStore({ "/oil?pagenumber=2": () => htmlResponse("<html></html>") });
    await expect(othobaAdapter.search("olive oil 17 l", ctx())).resolves.toEqual([]);
  });

  it("reports HTTP failures, blocks and timeouts as errors instead of empty results", async () => {
    mockStore({ "/oil": () => htmlResponse("", 500) });
    await expect(othobaAdapter.search("soybean oil", ctx())).rejects.toBeInstanceOf(StoreError);

    mockStore({ "/oil": () => htmlResponse("", 403) });
    await expect(othobaAdapter.search("soybean oil", ctx())).rejects.toBeInstanceOf(StoreBlockedError);

    const aborted = new AbortController();
    aborted.abort();
    vi.stubGlobal("fetch", vi.fn(async (_u: URL, init: RequestInit) => {
      init.signal?.throwIfAborted();
      return htmlResponse("");
    }));
    await expect(othobaAdapter.search("soybean oil", { signal: aborted.signal })).rejects.toThrow();
  });

  it("reports a parse error when product pages load but contain no product data", async () => {
    mockStore({
      "/fresh-fortified-soyebean-oil-5ltr-meghna-group-of-industries-709817": () => htmlResponse("<html>changed</html>"),
      "/fresh-rice-bran-oil-5ltr-4-pcs-bundle": () => htmlResponse("<html>changed</html>"),
    });
    await expect(othobaAdapter.search("fresh oil 5 ltr bundle", ctx())).rejects.toMatchObject({ kind: "parse" });
  });
});
