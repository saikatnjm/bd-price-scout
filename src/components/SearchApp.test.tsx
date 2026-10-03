// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResponse } from "@/lib/types";

// What the API sends; the client builds `groups` itself when they are absent.
type ApiBody = Omit<SearchResponse, "groups">;
import { SearchApp } from "./SearchApp";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function search(text: string) {
  fireEvent.change(screen.getByLabelText("Product name"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Find Best Price" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SearchApp", () => {
  it("shows the idle state initially", () => {
    render(<SearchApp />);
    expect(screen.getByText("Enter a product name to compare prices.")).toBeTruthy();
  });

  it("shows loading, then the empty state", async () => {
    let resolve: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    render(<SearchApp />);

    search("Galaxy S25");
    expect(await screen.findByRole("status")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Searching…" }) as HTMLButtonElement).disabled).toBe(true);

    const data: ApiBody = { query: "Galaxy S25", results: [], stores: [], searchedAt: new Date().toISOString() };
    resolve(jsonResponse(data));
    expect(await screen.findByText("No stores are configured yet.")).toBeTruthy();
  });

  it("renders real-shaped results: name, image, price, discount, availability, seller and link", async () => {
    const data: ApiBody = {
      query: "Phone",
      searchedAt: new Date().toISOString(),
      stores: [
        { storeId: "a", storeName: "Store A", status: "ok", durationMs: 10, resultCount: 2 },
        { storeId: "b", storeName: "Store B", status: "timeout", durationMs: 8000, resultCount: 0 },
      ],
      results: [
        { storeId: "a", storeName: "Store A", title: "Fresh Soybean Oil 5ltr", url: "https://a.example/1", price: 990, regularPrice: 1000, currency: "BDT", availability: "in_stock", imageUrl: "https://img.a.example/1.webp", brand: "Fresh", seller: "Meghna", pack: { size: { value: 5, unit: "l" }, multipack: false, bundle: false, total: { value: 5000, unit: "ml" } }, checkedAt: "" },
        { storeId: "a", storeName: "Store A", title: "Phone 2", url: "javascript:alert(1)", price: null, regularPrice: null, currency: "BDT", availability: "out_of_stock", checkedAt: "" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(data)));
    render(<SearchApp />);

    search("Phone");
    expect(await screen.findByText("Fresh Soybean Oil 5ltr")).toBeTruthy();
    expect(screen.getByText("৳990")).toBeTruthy();
    expect(screen.getByText("৳1,000")).toBeTruthy();
    expect(screen.getByText(/Save ৳10/)).toBeTruthy();
    expect(screen.getByText("Fresh")).toBeTruthy();
    expect(screen.getByText("Seller: Meghna")).toBeTruthy();
    expect(screen.getByText("5 L")).toBeTruthy();
    expect(screen.getByText("In stock")).toBeTruthy();
    expect(screen.getByText("Out of stock")).toBeTruthy();
    expect(screen.getByText("Price unavailable")).toBeTruthy();
    expect((screen.getByRole("img", { name: "Fresh Soybean Oil 5ltr" }) as HTMLImageElement).src).toBe("https://img.a.example/1.webp");
    // Missing image: placeholder instead of a broken image.
    expect(screen.getByRole("img", { name: "No image available" })).toBeTruthy();
    // Only the safe http(s) link is rendered.
    const links = screen.getAllByRole("link", { name: "View on Store A (opens in a new tab)" }) as HTMLAnchorElement[];
    expect(links.map((l) => l.href)).toEqual(["https://a.example/1"]);
    expect(links[0]?.target).toBe("_blank");
    expect(screen.getByRole("note").textContent).toContain("Store B (Timed out)");
  });

  it("replaces a broken image with the placeholder", async () => {
    const data: ApiBody = {
      query: "oil", searchedAt: new Date().toISOString(),
      stores: [{ storeId: "a", storeName: "Store A", status: "ok", durationMs: 10, resultCount: 1 }],
      results: [{ storeId: "a", storeName: "Store A", title: "Oil 1L", url: "https://a.example/1", price: 200, regularPrice: null, currency: "BDT", availability: "in_stock", imageUrl: "https://img.a.example/blocked.jpeg", checkedAt: "" }],
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(data)));
    render(<SearchApp />);
    search("oil");
    fireEvent.error(await screen.findByRole("img", { name: "Oil 1L" }));
    expect(screen.getByRole("img", { name: "No image available" })).toBeTruthy();
    expect(screen.getByText("Oil 1L")).toBeTruthy();
  });

  it("drops a malformed result but still renders the valid ones", async () => {
    const body = {
      query: "oil", searchedAt: new Date().toISOString(),
      stores: [{ storeId: "a", storeName: "Store A", status: "ok", durationMs: 10, resultCount: 2 }],
      results: [
        { storeId: "a", storeName: "Store A", title: "Good Oil", url: "https://a.example/1", price: 200, regularPrice: null, currency: "BDT", availability: "in_stock", checkedAt: "" },
        { storeId: "a", storeName: "Store A", title: 42, url: null, price: "free", availability: "maybe" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body)));
    render(<SearchApp />);
    search("oil");
    expect(await screen.findByText("Good Oil")).toBeTruthy();
    expect(screen.getAllByTestId("product-group")).toHaveLength(1);
  });

  it("shows no-results and all-stores-failed states", async () => {
    const empty: ApiBody = { query: "xyz", searchedAt: new Date().toISOString(), results: [], stores: [{ storeId: "a", storeName: "Store A", status: "empty", durationMs: 5, resultCount: 0 }] };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(empty)));
    render(<SearchApp />);
    search("xyz");
    expect(await screen.findByText("No products found for “xyz”.")).toBeTruthy();
    cleanup();

    const failed: ApiBody = { query: "oil", searchedAt: new Date().toISOString(), results: [], stores: [{ storeId: "a", storeName: "Store A", status: "error", durationMs: 5, resultCount: 0, message: "Store returned an error (HTTP 500)." }] };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(failed)));
    render(<SearchApp />);
    search("oil");
    expect(await screen.findByText("Stores could not be searched right now. Please try again.")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("Store A (Failed: Store returned an error (HTTP 500).)");
  });

  it("labels single-store results and never marks a lowest price", async () => {
    const data: ApiBody = {
      query: "oil", searchedAt: new Date().toISOString(),
      stores: [{ storeId: "othoba", storeName: "Othoba", status: "ok", durationMs: 10, resultCount: 2 }],
      results: [
        { storeId: "othoba", storeName: "Othoba", title: "Oil 5L", url: "https://othoba.example/1", price: 990, regularPrice: null, currency: "BDT", availability: "in_stock", checkedAt: "" },
        { storeId: "othoba", storeName: "Othoba", title: "Oil 1L", url: "https://othoba.example/2", price: 200, regularPrice: null, currency: "BDT", availability: "in_stock", variant: { flavour: "Masala" }, checkedAt: "" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(data)));
    render(<SearchApp />);
    search("oil");
    expect(await screen.findByText("2 products. Results from Othoba only, so prices are not compared across stores.")).toBeTruthy();
    expect(screen.getAllByTestId("product-group")).toHaveLength(2);
    expect(screen.queryByText("Lowest price")).toBeNull();
    // Meaningful variants are shown next to the pack size.
    expect(screen.getByText("Masala")).toBeTruthy();
  });

  it("shows a confirmed multi-store group side by side with the lowest in-stock price marked", async () => {
    const a = { storeId: "s1", storeName: "Store One", title: "Lux Soap 100g", url: "https://one.example/lux", price: 60, regularPrice: null, currency: "BDT" as const, availability: "in_stock" as const, checkedAt: "" };
    const b = { ...a, storeId: "s2", storeName: "Store Two", url: "https://two.example/lux", price: 55 };
    const c = { ...a, storeId: "s3", storeName: "Store Three", url: "https://three.example/lux", price: 50, availability: "out_of_stock" as const };
    const body = {
      query: "lux", searchedAt: new Date().toISOString(),
      stores: [a, b, c].map((o) => ({ storeId: o.storeId, storeName: o.storeName, status: "ok", durationMs: 5, resultCount: 1 })),
      results: [a, b, c],
      groups: [{ id: "g1", title: "Lux Soap 100g", offers: [a, b, c], storeCount: 3, matchBasis: "gtin" }],
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body)));
    render(<SearchApp />);
    search("lux");
    expect(await screen.findByText("Same product at 3 stores")).toBeTruthy();
    expect(screen.getAllByTestId("product-group")).toHaveLength(1);
    // Lowest among in-stock offers (৳55), not the cheaper out-of-stock one (৳50).
    expect(screen.getByText("৳55").textContent).toContain("Lowest price");
    expect(screen.getByText("৳50").textContent).not.toContain("Lowest price");
    const links = (screen.getAllByRole("link", { name: /^View on Store/ }) as HTMLAnchorElement[]).map((l) => l.href);
    expect(links).toEqual(["https://one.example/lux", "https://two.example/lux", "https://three.example/lux"]);
    expect(screen.queryByText(/Results from .* only/)).toBeNull();
  });

  it("shows an error for an invalid API payload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ nope: true })));
    render(<SearchApp />);
    search("oil");
    expect((await screen.findByRole("alert")).textContent).toContain("invalid response");
  });

  it("shows the API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: { code: "INVALID_QUERY", message: "Bad query." } }, 400)),
    );
    render(<SearchApp />);
    search("ab");
    expect((await screen.findByRole("alert")).textContent).toContain("Bad query.");
  });

  it("validates short queries client-side without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchApp />);
    search(" a ");
    expect((await screen.findByRole("alert")).textContent).toContain("at least 2");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
