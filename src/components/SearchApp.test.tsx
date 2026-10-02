// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResponse } from "@/lib/types";
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

    const data: SearchResponse = { query: "Galaxy S25", results: [], stores: [], searchedAt: new Date().toISOString() };
    resolve(jsonResponse(data));
    expect(await screen.findByText("No stores are configured yet.")).toBeTruthy();
  });

  it("renders results and only links safe URLs", async () => {
    const data: SearchResponse = {
      query: "Phone",
      searchedAt: new Date().toISOString(),
      stores: [
        { storeId: "a", storeName: "Store A", status: "ok", durationMs: 10, resultCount: 2 },
        { storeId: "b", storeName: "Store B", status: "timeout", durationMs: 8000, resultCount: 0 },
      ],
      results: [
        { storeId: "a", storeName: "Store A", title: "Phone 1", url: "https://a.example/1", price: 125000, regularPrice: null, currency: "BDT", availability: "in_stock", checkedAt: "" },
        { storeId: "a", storeName: "Store A", title: "Phone 2", url: "javascript:alert(1)", price: null, regularPrice: null, currency: "BDT", availability: "unknown", checkedAt: "" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(data)));
    render(<SearchApp />);

    search("Phone");
    expect(await screen.findByText("৳1,25,000")).toBeTruthy();
    expect(screen.getByText("Price unavailable")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "View at store" })).toHaveLength(1);
    expect(screen.getByRole("note").textContent).toContain("Store B (Timed out)");
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
