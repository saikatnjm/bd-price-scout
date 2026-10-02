import { afterEach, describe, expect, it, vi } from "vitest";
import { StoreBlockedError, type StoreAdapter, type StoreCandidate } from "../stores/types";
import { runSearch } from "./orchestrator";

const config = { storeTimeoutMs: 50, budgetMs: 200 };

const candidate: StoreCandidate = {
  title: "Phone X 8GB/256GB",
  url: "https://a.example/p/1",
  price: 1000,
  regularPrice: null,
  availability: "in_stock",
};

function adapter(id: string, search: StoreAdapter["search"]): StoreAdapter {
  return { id, name: id.toUpperCase(), origin: `https://${id}.example`, search };
}

afterEach(() => vi.restoreAllMocks());

describe("runSearch", () => {
  it("returns an empty response when no stores are configured", async () => {
    const res = await runSearch("phone", [], config);
    expect(res.results).toEqual([]);
    expect(res.groups).toEqual([]);
    expect(res.stores).toEqual([]);
    expect(res.query).toBe("phone");
  });

  it("isolates failures: ok, empty, blocked, error and timeout stores", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runSearch(
      "phone",
      [
        adapter("ok", async () => [candidate]),
        adapter("empty", async () => []),
        adapter("blocked", async () => {
          throw new StoreBlockedError();
        }),
        adapter("broken", async () => {
          throw new Error("parse failure");
        }),
        // Ignores the abort signal entirely; the orchestrator must still give up.
        adapter("slow", () => new Promise(() => {})),
      ],
      config,
    );

    expect(Object.fromEntries(res.stores.map((s) => [s.storeId, s.status]))).toEqual({
      ok: "ok",
      empty: "empty",
      blocked: "blocked",
      broken: "error",
      slow: "timeout",
    });
    expect(res.results).toHaveLength(1);
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0]?.offers[0]?.url).toBe("https://a.example/p/1");
    expect(res.results[0]).toMatchObject({ storeId: "ok", storeName: "OK", currency: "BDT", price: 1000 });
    expect(res.stores.find((s) => s.storeId === "broken")?.message).not.toContain("parse failure");
  });

  it("passes an abort signal that fires on timeout", async () => {
    let aborted = false;
    await runSearch(
      "phone",
      [
        adapter("slow", (_query, { signal }) =>
          new Promise((resolve) => {
            signal.addEventListener("abort", () => {
              aborted = true;
              resolve([]);
            });
          }),
        ),
      ],
      config,
    );
    expect(aborted).toBe(true);
  });
});
