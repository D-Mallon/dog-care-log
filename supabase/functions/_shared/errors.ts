import { InvalidJsonError, jsonResponse } from "./cors.ts";

/** An error that is safe to return to the client with an HTTP status. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = "billing_error") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Convert any thrown value into a JSON response.
 *
 * Expected failures (bad auth, non-owner, missing configuration) use
 * `HttpError`. Anything else is logged and returned as a generic 500 so we
 * never leak Stripe/Supabase internals to the browser.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      { error: error.message, code: error.code },
      error.status,
    );
  }

  if (error instanceof InvalidJsonError) {
    return jsonResponse(
      { error: error.message, code: "invalid_json" },
      400,
    );
  }

  console.error("Unhandled billing function error:", error);
  return jsonResponse(
    { error: "Something went wrong. Please try again.", code: "internal_error" },
    500,
  );
}
