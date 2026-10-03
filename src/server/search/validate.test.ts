import { describe, expect, it } from "vitest";
import { AppError } from "../errors";
import { MAX_BODY_BYTES, parseSearchRequest, readRequestBody } from "./validate";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof AppError ? err.code : "NOT_APP_ERROR";
  }
  return undefined;
}

describe("parseSearchRequest", () => {
  it("normalizes whitespace", () => {
    expect(parseSearchRequest(JSON.stringify({ query: "  Galaxy   S25\tUltra " }))).toEqual({
      query: "Galaxy S25 Ultra",
    });
  });

  it("rejects invalid JSON, missing, short and long queries", () => {
    expect(codeOf(() => parseSearchRequest("{not json"))).toBe("INVALID_REQUEST");
    expect(codeOf(() => parseSearchRequest("null"))).toBe("INVALID_QUERY");
    expect(codeOf(() => parseSearchRequest(JSON.stringify({ query: 42 })))).toBe("INVALID_QUERY");
    expect(codeOf(() => parseSearchRequest(JSON.stringify({ query: " a " })))).toBe("INVALID_QUERY");
    expect(codeOf(() => parseSearchRequest(JSON.stringify({ query: "x".repeat(121) })))).toBe("INVALID_QUERY");
  });

  it("rejects oversized bodies", () => {
    expect(codeOf(() => parseSearchRequest(" ".repeat(MAX_BODY_BYTES + 1)))).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("readRequestBody", () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/search", { method: "POST", body, headers, duplex: "half" } as RequestInit);

  it("reads a normal body", async () => {
    await expect(readRequestBody(post('{"query":"rice"}'))).resolves.toBe('{"query":"rice"}');
  });

  it("rejects a declared oversized body without reading it", async () => {
    let pulled = false;
    const stream = new ReadableStream({
      pull(c) {
        pulled = true;
        c.enqueue(new Uint8Array(10));
      },
    });
    await expect(readRequestBody(post(stream, { "content-length": "999999" }))).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(pulled).toBe(false);
  });

  it("stops reading an undeclared (streamed) body once it exceeds the limit", async () => {
    let chunks = 0;
    const stream = new ReadableStream({
      pull(c) {
        chunks++;
        c.enqueue(new Uint8Array(1024));
        if (chunks > 1000) c.close();
      },
    });
    await expect(readRequestBody(post(stream))).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(chunks).toBeLessThan(10);
  });
});
