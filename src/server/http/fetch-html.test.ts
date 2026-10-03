import { afterEach, describe, expect, it, vi } from "vitest";
import { StoreBlockedError, StoreError } from "../stores/types";
import { fetchHtml } from "./fetch-html";

const opts = () => ({ signal: new AbortController().signal, allowedHosts: ["store.example"] });
const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });

afterEach(() => vi.unstubAllGlobals());

describe("fetchHtml", () => {
  it("fetches allow-listed https pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => html("<p>ok</p>")),
    );
    await expect(fetchHtml("https://store.example/p", opts())).resolves.toBe("<p>ok</p>");
  });

  it("refuses other hosts, plain http and credentials before any request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchHtml("https://evil.example/", opts())).rejects.toBeInstanceOf(StoreError);
    await expect(fetchHtml("http://store.example/", opts())).rejects.toBeInstanceOf(StoreError);
    await expect(fetchHtml("https://u:p@store.example/", opts())).rejects.toBeInstanceOf(StoreError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows same-host redirects but never off the allow-list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        url.pathname === "/old"
          ? new Response(null, { status: 301, headers: { location: "/new" } })
          : url.pathname === "/new"
            ? html("moved")
            : new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
      ),
    );
    await expect(fetchHtml("https://store.example/old", opts())).resolves.toBe("moved");
    await expect(fetchHtml("https://store.example/ssrf", opts())).rejects.toBeInstanceOf(StoreError);
  });

  it("maps refusals to blocked and other failures to typed errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => html("", { status: 403 })),
    );
    await expect(fetchHtml("https://store.example/", opts())).rejects.toBeInstanceOf(StoreBlockedError);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        html("", { status: 503, headers: { "cf-mitigated": "challenge", "content-type": "text/html" } }),
      ),
    );
    await expect(fetchHtml("https://store.example/", opts())).rejects.toBeInstanceOf(StoreBlockedError);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => html("", { status: 500 })),
    );
    await expect(fetchHtml("https://store.example/", opts())).rejects.toMatchObject({ kind: "http" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } })),
    );
    await expect(fetchHtml("https://store.example/", opts())).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("releases bodies it does not read (errors, blocks, redirects)", async () => {
    const cancelled: string[] = [];
    const tracked = (label: string, init: ResponseInit) =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(new TextEncoder().encode("x"));
          },
          cancel() {
            cancelled.push(label);
          },
        }),
        init,
      );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        url.pathname === "/err"
          ? tracked("500", { status: 500, headers: { "content-type": "text/html" } })
          : url.pathname === "/blocked"
            ? tracked("403", { status: 403, headers: { "content-type": "text/html" } })
            : url.pathname === "/moved"
              ? tracked("301", { status: 301, headers: { location: "/err" } })
              : tracked("json", { status: 200, headers: { "content-type": "application/json" } }),
      ),
    );
    await expect(fetchHtml("https://store.example/err", opts())).rejects.toBeInstanceOf(StoreError);
    await expect(fetchHtml("https://store.example/blocked", opts())).rejects.toBeInstanceOf(StoreBlockedError);
    await expect(fetchHtml("https://store.example/moved", opts())).rejects.toBeInstanceOf(StoreError);
    await expect(fetchHtml("https://store.example/json", opts())).rejects.toBeInstanceOf(StoreError);
    expect(cancelled).toEqual(["500", "403", "301", "500", "json"]);
  });

  it("caps response size", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => html("x".repeat(2000))),
    );
    await expect(fetchHtml("https://store.example/", { ...opts(), maxBytes: 1000 })).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });
});
