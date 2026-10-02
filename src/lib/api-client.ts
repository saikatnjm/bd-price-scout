import type { ApiErrorBody, SearchResponse } from "./types";

export class SearchRequestError extends Error {}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string";
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  let response: Response;
  try {
    response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new SearchRequestError("Could not reach the server. Check your connection and try again.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SearchRequestError(
      isApiErrorBody(body) ? body.error.message : `Search failed (HTTP ${response.status}).`,
    );
  }
  if (body === null) throw new SearchRequestError("The server returned an invalid response.");
  return body as SearchResponse;
}
