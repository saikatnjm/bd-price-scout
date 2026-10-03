import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../../../../tests/fixtures";
import { StoreBlockedError, StoreError } from "../types";
import { createOthobaAdapter, othobaAdapter } from "./adapter";

const htmlResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

type Route = (init?: RequestInit) => Response | Promise<Response>;

/** A request that never answers until it is aborted (simulates a stalled store page). */
const stall: Route = (init) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  });

const pages: Record<string, Route> = {
  "/oil": () => htmlResponse(loadFixture("othoba/category-oil")),
  "/fresh-fortified-soyebean-oil-5ltr-meghna-group-of-industries-709817": () =>
    htmlResponse(loadFixture("othoba/product-discounted")),
  "/fresh-rice-bran-oil-5ltr-4-pcs-bundle": () => htmlResponse(loadFixture("othoba/product-bundle")),
};

function mockStore(overrides: Record<string, Route> = {}) {
  const fetchMock = vi.fn(async (input: URL, init?: RequestInit) => {
    const route =
      { ...pages, ...overrides }[input.pathname + input.search] ?? { ...pages, ...overrides }[input.pathname];
    // Pages without a fixture answer 404, exercising partial-failure handling.
    return route ? route(init) : htmlResponse("not found", 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ctx = () => ({ signal: new AbortController().signal });
const requested = (m: ReturnType<typeof mockStore>) =>
  m.mock.calls.map(([u]) => (u as URL).pathname + (u as URL).search);

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

  it("does not require category descriptor words like 'cooking' in product names", async () => {
    const fetchMock = mockStore();
    const results = await othobaAdapter.search("cooking oil", ctx());
    expect(requested(fetchMock)[0]).toBe("/oil");
    expect(results.map((r) => r.storeProductId)).toContain("709817");
  });

  it("maps 'dishwashing' queries to the cleaning category", async () => {
    const fetchMock = mockStore({ "/cleaning-supplies": () => htmlResponse("<html></html>") });
    await othobaAdapter.search("dishwashing liquid", ctx());
    expect(requested(fetchMock)).toEqual(["/cleaning-supplies"]);
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: URL, init: RequestInit) => {
        init.signal?.throwIfAborted();
        return htmlResponse("");
      }),
    );
    await expect(othobaAdapter.search("soybean oil", { signal: aborted.signal })).rejects.toThrow();
  });

  it("returns the other products when one product page stalls (per-request timeout)", async () => {
    mockStore({ "/fresh-fortified-soyebean-oil-5ltr-2": stall });
    const adapter = createOthobaAdapter({ requestTimeoutMs: 100 });
    const started = Date.now();
    const results = await adapter.search("fresh soybean oil 5 ltr", ctx());
    expect(results.map((r) => r.storeProductId)).toEqual(["709817"]);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("fails with a timeout when every product page stalls", async () => {
    mockStore({
      "/fresh-fortified-soyebean-oil-5ltr-meghna-group-of-industries-709817": stall,
      "/fresh-fortified-soyebean-oil-5ltr-2": stall,
      "/fresh-fortified-soyebean-oil-5ltr-4-pcs-bundle": stall,
    });
    await expect(
      createOthobaAdapter({ requestTimeoutMs: 100 }).search("fresh soybean oil 5 ltr", ctx()),
    ).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("fails with a timeout when the category page stalls", async () => {
    mockStore({ "/oil": stall });
    await expect(createOthobaAdapter({ requestTimeoutMs: 100 }).search("soybean oil", ctx())).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("never requests more than 2 category pages and 5 product pages", async () => {
    const fetchMock = mockStore({ "/oil?pagenumber=2": () => htmlResponse(loadFixture("othoba/category-oil")) });
    await othobaAdapter.search("oil", ctx());
    const paths = requested(fetchMock);
    expect(paths.filter((p) => p.startsWith("/oil")).length).toBeLessThanOrEqual(2);
    expect(paths.filter((p) => !p.startsWith("/oil")).length).toBeLessThanOrEqual(5);
  });

  it("reports a parse error when product pages load but contain no product data", async () => {
    mockStore({
      "/fresh-fortified-soyebean-oil-5ltr-meghna-group-of-industries-709817": () =>
        htmlResponse("<html>changed</html>"),
      "/fresh-rice-bran-oil-5ltr-4-pcs-bundle": () => htmlResponse("<html>changed</html>"),
    });
    await expect(othobaAdapter.search("fresh oil 5 ltr bundle", ctx())).rejects.toMatchObject({ kind: "parse" });
  });
});
