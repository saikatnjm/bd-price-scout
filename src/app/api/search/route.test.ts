import { describe, expect, it } from "vitest";
import { POST } from "./route";

function post(body: string): Request {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/search", () => {
  it("returns a search response for a valid query", async () => {
    const res = await POST(post(JSON.stringify({ query: "iPhone 16 128GB" })));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ query: "iPhone 16 128GB", results: [], stores: [] });
  });

  it("returns a structured 400 for invalid input", async () => {
    const res = await POST(post("{bad"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." },
    });
  });
});
