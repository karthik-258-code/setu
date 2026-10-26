# Decisions (ADR-lite)

One line per decision. Newest at the bottom. Agents append here when they resolve an ambiguity; humans append here when they change direction.

Format: `- YYYY-MM-DD [task] Decision. Reason.`

- 2026-10-26 [foundation] Monorepo with pnpm workspaces: `packages/engine`, `packages/content`, `packages/shared`, `apps/web`, `apps/api`. One language (TypeScript) across engine, web and API so the engine runs unchanged offline and on the server.
- 2026-10-26 [foundation] Student state is event-sourced: `StudentState = replay(pack, events)`. Sync is an idempotent append of events. Removes any possibility of offline/online estimate drift and makes paper entry and teacher actions ordinary events.
- 2026-10-26 [foundation] Engine is pure and deterministic (`now` and seeded `rng` are parameters). Required for golden-vector tests shared by browser and server, and for reproducible simulations.
- 2026-10-26 [foundation] Engine returns `ruleId + reasonParams`; bilingual reason text lives in the content pack. Keeps the engine free of user-facing strings and makes adding a language a content change.
- 2026-10-26 [foundation] Content is versioned JSON in the repository and is **not** stored in PostgreSQL in v0.1. Packs are static files. Fewer tables, simpler sync, and the same files serve demo mode.
- 2026-10-26 [foundation] Readiness Check asks **one** question per direct prerequisite first, then descends on failures, then confirms with second questions. The submission's "two per prerequisite" would exceed the 12-item budget for chapters with 7 external prerequisites.
- 2026-10-26 [foundation] Demo mode (`LocalDemoApiClient`) runs the full teacher and student experience in the browser over a seeded classroom. The Prove-round demo must not depend on the API or network.
- 2026-10-26 [foundation] Simulation is written in TypeScript against the real engine (`pnpm sim`); Python/pyBKT fitting is Phase 7 stretch. Same code under evaluation as in production.
- 2026-10-26 [foundation] Graph spans Classes 6 to 10 on the algebra spine with one full-depth chapter (Class 8 LEQ) and three skeleton chapters (Class 7, 9, 10). Answers the evaluator's scalability ask within the Build-round budget.
- 2026-10-26 [foundation] GitHub is the final home. `.github/workflows/ci.yml` is canonical; `.gitlab-ci.yml` mirrors it while hosted on GitLab. Push mirroring from GitLab to GitHub keeps both in sync during the event.
- 2026-10-26 [foundation] Student PII limited to `firstName`, `rollNo`, `classroomId`, `lang`, `pinHash`, as in the submission's DPDP Act analysis.
