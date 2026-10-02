import { describe, expect, it } from "vitest";
import { AppError } from "../errors";
import { MAX_BODY_BYTES, parseSearchRequest } from "./validate";

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
