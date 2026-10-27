import type { z } from "zod";

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * Compile-time drift check between a zod schema and an engine type `T`.
 * The schema's output must be assignable to `T` and `T` to the output, so adding,
 * removing or retyping a field or a union variant in `types.ts` without updating the
 * schema fails `pnpm typecheck`. (The content package's `mirror` checks one direction
 * only; this one is exact because events cross the network.)
 */
export function mirror<T>() {
  return <S extends z.ZodType<T, z.ZodTypeDef, unknown>>(
    schema: S & (Exact<T, z.output<S>> extends true ? unknown : never),
  ): S => schema;
}
