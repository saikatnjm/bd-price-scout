import "server-only";
import { QUERY_MAX_LENGTH, QUERY_MIN_LENGTH } from "@/lib/types";
import { AppError } from "../errors";

export const MAX_BODY_BYTES = 2048;

const tooLarge = () => new AppError("PAYLOAD_TOO_LARGE", "Request is too large.", 413);

/**
 * Reads the request body but stops as soon as it exceeds MAX_BODY_BYTES, so an oversized
 * body is never buffered in memory (Vercel caps bodies at 4.5 MB; a self-hosted server
 * would not).
 */
export async function readRequestBody(request: Request): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw tooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export function parseSearchRequest(rawBody: string): { query: string } {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) throw tooLarge();

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new AppError("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }

  const rawQuery = typeof body === "object" && body !== null ? (body as { query?: unknown }).query : undefined;
  if (typeof rawQuery !== "string") {
    throw new AppError("INVALID_QUERY", "Enter a product to search for.", 400);
  }

  const query = rawQuery.replace(/\s+/g, " ").trim();
  if (query.length < QUERY_MIN_LENGTH) {
    throw new AppError("INVALID_QUERY", `Search must be at least ${QUERY_MIN_LENGTH} characters.`, 400);
  }
  if (query.length > QUERY_MAX_LENGTH) {
    throw new AppError("INVALID_QUERY", `Search must be at most ${QUERY_MAX_LENGTH} characters.`, 400);
  }
  return { query };
}
