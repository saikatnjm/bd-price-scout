import "server-only";
import { StoreBlockedError, StoreError } from "../stores/types";

const USER_AGENT = "BDPriceScout/0.1 (+https://github.com/saikatnjm/bd-price-scout)";
const DEFAULT_MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

export interface FetchHtmlOptions {
  signal: AbortSignal;
  /** Exact hostnames that may be fetched (redirect targets included). */
  allowedHosts: readonly string[];
  maxBytes?: number;
}

function assertAllowed(url: URL, allowedHosts: readonly string[]): void {
  if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname) || url.username || url.password) {
    throw new StoreError("invalid_response", "Store link pointed outside the store.");
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await discard(response);
    throw new StoreError("invalid_response", "Store page was unexpectedly large.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new StoreError("invalid_response", "Store page was unexpectedly large.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Releases a response body we are not going to read, so the connection is freed. */
async function discard(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Already consumed or aborted: nothing to release.
  }
}

/**
 * Fetches an HTML page from an allow-listed store host. Never follows redirects off the
 * allow-list (SSRF guard), caps response size, and maps refusals to typed store errors.
 */
export async function fetchHtml(rawUrl: string, options: FetchHtmlOptions): Promise<string> {
  const { signal, allowedHosts, maxBytes = DEFAULT_MAX_BYTES } = options;
  let url = new URL(rawUrl);

  for (let redirects = 0; ; redirects++) {
    assertAllowed(url, allowedHosts);
    const response = await fetch(url, {
      signal,
      redirect: "manual",
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "en" },
    });

    if (response.status >= 300 && response.status < 400) {
      await discard(response);
      const location = response.headers.get("location");
      if (!location || redirects >= MAX_REDIRECTS) {
        throw new StoreError("invalid_response", "Store redirected unexpectedly.");
      }
      url = new URL(location, url);
      continue;
    }

    // Cloudflare marks challenge responses; never try to solve them.
    if (response.headers.get("cf-mitigated") === "challenge" || response.status === 403 || response.status === 429) {
      await discard(response);
      throw new StoreBlockedError(`Store refused the request (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      await discard(response);
      throw new StoreError("http", `Store returned an error (HTTP ${response.status}).`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      await discard(response);
      throw new StoreError("invalid_response", "Store returned an unexpected response.");
    }
    return readCapped(response, maxBytes);
  }
}
