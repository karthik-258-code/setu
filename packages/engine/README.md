# @setu/engine

Pure, deterministic TypeScript. Zero runtime dependencies. Runs unchanged in the browser (offline) and on the server.

The public API and algorithm specification live in [docs/ARCHITECTURE.md section 5](../../docs/ARCHITECTURE.md#5-engine-setuengine). The type contract is [`src/types.ts`](src/types.ts).

Rules for anyone editing this package:

- No `Date.now()`, `Math.random()`, `fetch`, `console`, or imports from other workspace packages. Pass `now` and `rng` in.
- Every exported function has unit tests. BKT numbers are asserted to 6 decimals against hand-computed values.
- Golden vectors in `test/golden/` are shared with `apps/api` tests; do not regenerate them without a DECISIONS.md entry.
- User-facing text never lives here. Recommendations return `ruleId` + `reasonParams`; the pack supplies bilingual templates.
