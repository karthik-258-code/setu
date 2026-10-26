# AGENTS.md: rules for coding agents working on Setu

You are building **Setu**, a teacher-centred, offline-first adaptive learning system for Classes 6 to 10 (Code Kernel '26, Build round). Humans own the architecture; you own implementation of the tasks in `docs/BUILD_PLAN.md`.

## Read first, every session

1. `docs/ARCHITECTURE.md` (the design; sections 5 and 6 are the engine and content specs)
2. `docs/BUILD_PLAN.md` (what to do, in order)
3. `packages/engine/src/types.ts` (the type contract)
4. `docs/DECISIONS.md` (choices already made; do not relitigate)

The hackathon background is in `docs/hackathon/`. Do not edit those three files.

## Hard rules

- **One task at a time.** Execute the task you were given. Do not start the next one, do not refactor unrelated code.
- **Engine purity.** `packages/engine` has zero runtime dependencies and no imports from other workspace packages. No `Date.now()`, `Math.random()`, `fetch`, `console`, `process`. `now` and `rng` are parameters.
- **One engine everywhere.** Never reimplement BKT, policy, readiness or grouping logic in `apps/web` or `apps/api`. Import from `@setu/engine`.
- **Events are the source of truth.** UI and API never mutate `StudentState` directly; they append events and replay.
- **Type contract changes** to `types.ts` require updating `docs/ARCHITECTURE.md` in the same commit and a line in `docs/DECISIONS.md`.
- **Bilingual by default.** Every student-facing string in content is `LocalizedText` with `en` and `te`. UI chrome uses the i18n helper with `en` and `te` keys. No hard-coded English in student screens.
- **No runtime AI.** No LLM or translation API calls from `apps/web` or `apps/api`. Offline drafting scripts (Phase 7) are the only place models appear, and their output is `reviewStatus: machine_draft`.
- **No new student PII fields** beyond `firstName`, `rollNo`, `classroomId`, `lang`, `pinHash`.
- **Bundle budget.** Student app stays under 1 MB gzipped JS. Do not add charting, animation, UI-kit or date libraries without a DECISIONS.md entry. Prefer hand-written SVG and `Intl`.
- **No placeholder code.** Do not leave `TODO` stubs, mock data in production paths, or functions that throw "not implemented". If a task cannot be completed, stop and say what is missing.
- **No extra documents.** Do not create summaries, usage guides or changelogs unless the task asks for a specific file.
- **GitHub compatibility.** The repository's final home is GitHub. Use relative links in docs, standard Markdown and Mermaid only, and keep `.github/workflows/ci.yml` passing. Never depend on GitLab-only features for anything essential.

## Conventions

- TypeScript strict, ESM, `verbatimModuleSyntax`. Named exports only. One module per concern as listed in ARCHITECTURE 5.1.
- Tests live next to the package in `test/` (engine, content, api) or `src/**/*.test.tsx` (web). Vitest everywhere. Test names describe behaviour, for example `descends into Class 6 when a Class 7 prerequisite fails`.
- Content JSON: 2-space indent, keys in the order of the type definition, ids follow ARCHITECTURE 6.1.
- Naming: `camelCase` for code, `SCREAMING_SNAKE` for constants and ids inside concept ids, `kebab-case` for file names in `apps/web`.
- React: function components, hooks, Tailwind utility classes, no CSS files beyond `index.css`. Student screens are mobile-first at 360 px wide and must be usable with one thumb.
- API: one Fastify plugin per route group, zod validation from `@setu/shared` on every body and query, errors as `{ error: { code, message } }`.
- Errors: fail loudly in validation and build steps; in the student UI, never block on a sync failure (queue and continue).

## Commands

```
pnpm install
pnpm dev                 # web + api
pnpm typecheck && pnpm lint && pnpm test
pnpm content:validate    # content rules (ARCHITECTURE 6.3)
pnpm content:pack        # build chapter packs
pnpm sim                 # simulation report -> docs/EVALUATION.md
pnpm build
```

## Definition of done for every task

1. The task's "Done when" in `docs/BUILD_PLAN.md` holds.
2. `pnpm typecheck && pnpm lint && pnpm test && pnpm content:validate && pnpm build` pass locally.
3. New behaviour has tests; engine changes keep golden vectors passing (or a DECISIONS.md entry explains a regeneration).
4. The task checkbox is ticked in `docs/BUILD_PLAN.md`.
5. One commit per task: `type(scope): summary [N.x]` where type is `feat | fix | test | docs | chore | content` and scope is `engine | content | web | api | shared | docs | ci`.

## Branching

- Work on `build/phase-N` branches; open a merge request / pull request per phase; squash-merge to `main`.
- `main` must always pass CI. Never force-push `main`.

## When something is unclear

Choose the simplest option consistent with `docs/ARCHITECTURE.md`, implement it, and append one line to `docs/DECISIONS.md` in the form `- YYYY-MM-DD [N.x] Decision. Reason.` Do not ask the human for choices that the architecture already constrains.
