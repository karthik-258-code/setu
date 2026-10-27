import { z } from "zod";
import { nonEmpty } from "./events";

/** Every API error body (AGENTS.md): `{ error: { code, message } }`. */
export const errorResponseSchema = z
  .object({
    error: z.object({ code: nonEmpty, message: z.string() }).strict(),
  })
  .strict();
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
