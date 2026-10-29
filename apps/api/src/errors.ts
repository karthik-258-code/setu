import type { z } from "zod";

/** An error with an HTTP status and an API error code, sent as `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Parses with a shared zod schema; a failure is a 400 naming each bad field. */
export function parseOr400<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    throw new ApiError(400, "BAD_REQUEST", message);
  }
  return result.data as z.infer<S>;
}
