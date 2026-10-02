import "server-only";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/types";

/** An error that is safe to show to the client. */
export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Converts any thrown value into a JSON error response without leaking internals. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: { code: err.code, message: err.message } } satisfies ApiErrorBody, {
      status: err.status,
    });
  }
  console.error("Unhandled server error", err);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } satisfies ApiErrorBody,
    { status: 500 },
  );
}
