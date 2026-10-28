# Setu Build Plan (Build round: 25 to 29 Oct 2026, Prove: 30 to 31 Oct)

Tasks are sized so a coding agent (Opus) can finish one in a single focused session. Work **one task at a time, in order within a phase**. Phases 1 to 3 and 6 are the critical path; Phase 4 (API) and Phase 5 beyond 5.3 are P1 because demo mode covers the Prove-round demo.

Tick the box when the task's "Done when" holds and CI is green.

## How to brief the coding agent

Paste this, replacing `N.x`:

> You are working in the Setu monorepo. Read `AGENTS.md`, `docs/ARCHITECTURE.md` and `docs/BUILD_PLAN.md` before touching code. Execute task **N.x** exactly as specified and nothing else. When the spec is ambiguous, choose the simplest option consistent with ARCHITECTURE.md and add a one-line entry to `docs/DECISIONS.md`. Before finishing: `pnpm typecheck && pnpm lint && pnpm test && pnpm content:validate && pnpm build` must pass; tick the task in BUILD_PLAN.md; commit as `type(scope): summary [N.x]`.

## Priority if time runs short

1. Engine (Phase 1) with tests.
2. Class 8 content at full depth (2.1 to 2.5, 2.7).
3. Student PWA in demo mode (3.1 to 3.8).
4. Teacher Gap Map and Groups in demo mode (5.2 to 5.4).
5. Evaluator deliverables (6.2 to 6.5).
6. API and real sync (Phase 4, 5.1, 3.9 to 3.10).

---

## Phase 0: Scaffold (26 Oct, ~2 h)

- [x] **0.1 Workspace tooling.** Add `pnpm-lock.yaml`; root ESLint flat config (typescript-eslint, react-hooks) and Prettier; `lint` scripts in every package. Choose a router for the web app and record it in DECISIONS.md.
  *Done when:* `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck` pass locally and CI is green on the branch.
- [x] **0.2 Engine package.** `packages/engine`: `src/index.ts`, `src/rng.ts` (mulberry32, pick, shuffle), vitest config, one smoke test. Add `sim` script placeholder that prints usage (filled in 6.2).
  *Done when:* `pnpm --filter @setu/engine test` runs a real test.
- [x] **0.3 Content package.** `packages/content` with `content/` folders from ARCHITECTURE 6.2, `src/schema.ts` (zod mirroring `types.ts`), `validate` and `pack` scripts (can validate an empty graph).
  *Done when:* `pnpm content:validate` passes on an empty content set and fails on a planted cycle (unit test).
- [x] **0.4 Shared package.** `packages/shared`: zod DTOs for every endpoint in ARCHITECTURE 8.1, `ApiClient` interface from 7.4.
- [x] **0.5 Web app shell.** `apps/web`: Vite + React + TS + Tailwind + `vite-plugin-pwa`; routes from 7.2 render placeholder pages with the route name; Dexie schema from 7.3; language toggle context (en/te) with a `t(LocalizedText)` helper and the "English only" marker.
  *Done when:* `pnpm dev` serves it, Lighthouse reports installable, bundle check in CI passes.
- [x] **0.6 API shell.** `apps/api`: Fastify + Prisma schema from 8.3 + `docker-compose.yml` (postgres 16) + `/health`. `.env.example` with `DATABASE_URL`, `JWT_SECRET`.
  *Done when:* `docker compose up -d && pnpm --filter @setu/api dev` answers `/health`.

## Phase 1: Engine (26 to 27 Oct)

- [x] **1.1 Graph.** `graph.ts` per ARCHITECTURE 5.1: build, `assertDag`, topo order, prereqs/ancestors/descendants, `chapterExternalPrereqs`, `frontier`, `rootCauseGap`. Tests on a 10-node fixture including a diamond and a cross-class chain.
- [x] **1.2 BKT.** `bkt.ts` per 5.2 with hand-computed test values (for example pL=0.3, correct, defaults gives posterior 0.6585366, updated 0.7268293).
- [x] **1.3 Replay reducer.** `replay.ts`: `initialState`, `applyEvent` for every `StudentEvent`, `replay`. Covers mastery, progress, readiness summary storage, rechecks, assigned, extension lock, recentAttempts cap, deterministic sort by `ts` then `id`. Test: order independence; teacher override + verification flow.
- [x] **1.4 Readiness.** `readiness.ts` per 5.3. Tests: never exceeds 12 items; descends from a failed prerequisite into Class 6; `advancedEntry` path; teacher-trimmed prerequisites skipped; `uncertain` on one-right-one-wrong.
- [x] **1.5 Ladder and policy.** `ladder.ts`, `policy.ts`, `selectQuestions.ts` per 5.4. Tests: every rule fires on a crafted state; Anjali and Ravi scenarios from the submission section 2.4 reproduce the described entry points and reasons (`ruleId`s), including the targeted worked example for `F-ADD-DENOM`.
- [x] **1.6 Re-checks.** `recheck.ts` per 5.5. Tests on interval progression and reopening.
- [x] **1.7 Gap Map and groups.** `grouping.ts` per 5.6. Tests: group cap of 5, `other` merge, dominant misconception, suggested questions, ready/not-attempted handling.
- [x] **1.8 Golden vectors.** `test/golden/`: three fixtures (Anjali, Ravi, an override case) as `(pack, events) -> expected StudentState`. Loader test in engine; the API will reuse them in 4.4.

## Phase 2: Content (27 Oct)

- [x] **2.1 Concept graph.** `content/graph/concepts.json` and `chapters.json` with the Classes 6 to 10 algebra spine below (titles en + te, boardTags `["NCERT","TS_SCERT"]`). Chapters: `CH.M7.SIMPLE_EQUATIONS` (skeleton), `CH.M8.LINEAR_EQ_ONE_VAR` (full), `CH.M9.LINEAR_EQ_TWO_VAR` (skeleton), `CH.M10.PAIR_LINEAR_EQ` (skeleton). Concepts outside these chapters get `chapterId` of a stub chapter per class (`CH.M6.FOUNDATIONS`, `CH.M7.FOUNDATIONS`, depth skeleton) so every concept has a home.
  *Done when:* validator passes the DAG check and `chapterExternalPrereqs(CH.M8.LINEAR_EQ_ONE_VAR)` returns exactly the seven listed below.
- [x] **2.2 Misconceptions and reasons.** `misconceptions.json` with the initial code list below (en + te labels, teacher notes). `reasons.json` with en + te templates for every `ruleId` in ARCHITECTURE 5.4 (for example `R5_LEARN`: "Before {chapter}, we are practising {concept}. You are nearly there.").
- [x] **2.3 Class 8 resources.** For every concept in `CH.M8.LINEAR_EQ_ONE_VAR` and all its ancestors: one `explanation` (en + te, 80 to 150 words, one small inline SVG where it helps), one generic `worked_example`, one `hint`; plus one misconception-targeted `worked_example` per code that appears on that concept's questions. Telugu follows Telangana SCERT terminology; keep a glossary in `content/glossary.md`.
- [x] **2.4 Class 8 hand-authored questions.** About 120 MCQ/numeric items across the same concept set: at least 2 per difficulty per concept; every wrong MCQ option that encodes a known error carries a `misconceptionCode`; `reviewStatus: draft`. Tag 10 word problems `word_problem` and 8 harder items `extension`.
- [x] **2.5 Template generators.** Generators in `packages/content/src/generators/`: `add_unlike_fractions`, `integer_add_sub`, `integer_mul_div`, `combine_like_terms`, `transpose_linear`, `linear_both_sides`, `linear_brackets`, `linear_fraction_coeff`. Each computes distractors from misconceptions (for example `F-ADD-DENOM`, `E-TRANSPOSE-SIGN`, `E-TRANSPOSE-DIVIDE`, `E-DIST-PARTIAL`). Templates in `content/templates/` to reach roughly 300 total questions.
  *Done when:* generated items are deterministic for a given seed (snapshot test) and the pack's question count is reported by the builder.
- [x] **2.6 Skeleton chapters.** For Class 7 Simple Equations, Class 9 LE2V, Class 10 PLE concepts: `en` explanation and at least 3 questions each (te optional, marked). Goal: a teacher can launch `CH.M9.LINEAR_EQ_TWO_VAR` and the Readiness Check reaches Class 8 and 7 concepts.
- [x] **2.7 Pack builder.** `pnpm content:pack` writes one pack per chapter to `apps/web/public/packs/` and `apps/api/packs/`, prints size per pack, fails above 5 MB.

### Concept spine for 2.1

Class 6: `M6.INT.CONCEPT`, `M6.INT.ADD_SUB`, `M6.NUM.LCM_HCF`, `M6.FRAC.CONCEPT`, `M6.FRAC.EQUIV`, `M6.FRAC.COMPARE`, `M6.FRAC.ADD_SUB_LIKE`, `M6.FRAC.ADD_SUB_UNLIKE`, `M6.DEC.CONCEPT`, `M6.DEC.ADD_SUB`, `M6.ALG.VARIABLE`, `M6.ALG.EQUATION_INTRO`

Class 7: `M7.INT.MUL_DIV`, `M7.INT.PROPERTIES`, `M7.FRAC.MUL`, `M7.FRAC.DIV`, `M7.DEC.MUL_DIV`, `M7.RAT.CONCEPT`, `M7.ALG.TERMS`, `M7.ALG.LIKE_TERMS`, `M7.ALG.ADD_SUB_EXPR`, `M7.ALG.VALUE_OF_EXPR`, `M7.SEQ.SETUP`, `M7.SEQ.BALANCE`, `M7.SEQ.TRANSPOSE`, `M7.SEQ.APPLY`

Class 8 (`CH.M8.LINEAR_EQ_ONE_VAR`, in order): `M8.LEQ.ONE_SIDE`, `M8.LEQ.BOTH_SIDES`, `M8.LEQ.BRACKETS`, `M8.LEQ.FRACTIONS`, `M8.LEQ.REDUCIBLE`, `M8.LEQ.WORD_NUMBER`, `M8.LEQ.WORD_AGE_PERIMETER`

Class 9: `M9.POLY.CONCEPT`, `M9.COORD.PLOT`, `M9.LE2V.CONCEPT`, `M9.LE2V.SOLUTIONS`, `M9.LE2V.GRAPH`

Class 10: `M10.PLE.GRAPHICAL`, `M10.PLE.SUBSTITUTION`, `M10.PLE.ELIMINATION`, `M10.PLE.WORD`

Prerequisite edges (`concept <- prerequisites`):

```
M6.INT.ADD_SUB        <- M6.INT.CONCEPT
M6.FRAC.EQUIV         <- M6.FRAC.CONCEPT
M6.FRAC.COMPARE       <- M6.FRAC.EQUIV
M6.FRAC.ADD_SUB_LIKE  <- M6.FRAC.CONCEPT
M6.FRAC.ADD_SUB_UNLIKE<- M6.FRAC.ADD_SUB_LIKE, M6.FRAC.EQUIV, M6.NUM.LCM_HCF
M6.DEC.ADD_SUB        <- M6.DEC.CONCEPT
M6.ALG.EQUATION_INTRO <- M6.ALG.VARIABLE
M7.INT.MUL_DIV        <- M6.INT.ADD_SUB
M7.INT.PROPERTIES     <- M7.INT.MUL_DIV
M7.FRAC.MUL           <- M6.FRAC.EQUIV
M7.FRAC.DIV           <- M7.FRAC.MUL
M7.DEC.MUL_DIV        <- M6.DEC.ADD_SUB, M7.INT.MUL_DIV
M7.RAT.CONCEPT        <- M7.INT.MUL_DIV, M6.FRAC.CONCEPT
M7.ALG.TERMS          <- M6.ALG.VARIABLE
M7.ALG.LIKE_TERMS     <- M7.ALG.TERMS, M6.INT.ADD_SUB
M7.ALG.ADD_SUB_EXPR   <- M7.ALG.LIKE_TERMS
M7.ALG.VALUE_OF_EXPR  <- M7.ALG.TERMS, M7.INT.MUL_DIV
M7.SEQ.SETUP          <- M6.ALG.EQUATION_INTRO, M7.ALG.TERMS
M7.SEQ.BALANCE        <- M6.ALG.EQUATION_INTRO, M6.INT.ADD_SUB
M7.SEQ.TRANSPOSE      <- M7.SEQ.BALANCE, M7.INT.MUL_DIV
M7.SEQ.APPLY          <- M7.SEQ.SETUP, M7.SEQ.TRANSPOSE
M8.LEQ.ONE_SIDE       <- M7.SEQ.TRANSPOSE, M7.FRAC.DIV
M8.LEQ.BOTH_SIDES     <- M8.LEQ.ONE_SIDE, M7.ALG.LIKE_TERMS
M8.LEQ.BRACKETS       <- M8.LEQ.BOTH_SIDES, M7.INT.PROPERTIES
M8.LEQ.FRACTIONS      <- M8.LEQ.BOTH_SIDES, M6.FRAC.ADD_SUB_UNLIKE, M7.FRAC.MUL
M8.LEQ.REDUCIBLE      <- M8.LEQ.FRACTIONS, M8.LEQ.BRACKETS
M8.LEQ.WORD_NUMBER    <- M8.LEQ.BOTH_SIDES, M7.SEQ.SETUP
M8.LEQ.WORD_AGE_PERIMETER <- M8.LEQ.WORD_NUMBER
M9.POLY.CONCEPT       <- M7.ALG.TERMS
M9.COORD.PLOT         <- M6.INT.CONCEPT
M9.LE2V.CONCEPT       <- M8.LEQ.BOTH_SIDES, M6.ALG.VARIABLE
M9.LE2V.SOLUTIONS     <- M9.LE2V.CONCEPT, M8.LEQ.ONE_SIDE
M9.LE2V.GRAPH         <- M9.LE2V.SOLUTIONS, M9.COORD.PLOT
M10.PLE.GRAPHICAL     <- M9.LE2V.GRAPH
M10.PLE.SUBSTITUTION  <- M9.LE2V.SOLUTIONS, M8.LEQ.BRACKETS
M10.PLE.ELIMINATION   <- M10.PLE.SUBSTITUTION
M10.PLE.WORD          <- M10.PLE.ELIMINATION, M8.LEQ.WORD_AGE_PERIMETER
```

Expected `chapterExternalPrereqs(CH.M8.LINEAR_EQ_ONE_VAR)`: `M7.SEQ.TRANSPOSE`, `M7.FRAC.DIV`, `M7.ALG.LIKE_TERMS`, `M7.INT.PROPERTIES`, `M6.FRAC.ADD_SUB_UNLIKE`, `M7.FRAC.MUL`, `M7.SEQ.SETUP`.

### Initial misconception codes for 2.2

| Code | Meaning |
|---|---|
| `F-ADD-DENOM` | adds numerators and denominators |
| `F-EQUIV-ADD` | makes an "equivalent" fraction by adding the same number to top and bottom |
| `F-COMPARE-NUM-ONLY` | compares unlike fractions by numerator only |
| `F-DIV-NO-RECIP` | divides fractions without taking the reciprocal |
| `I-SIGN-ADD` | wrong sign when adding integers of different signs |
| `I-SIGN-MUL` | negative times negative gives negative |
| `A-UNLIKE-COMBINE` | combines unlike terms (3x + 2 = 5x) |
| `A-COEFF-DROP` | drops a coefficient when combining |
| `E-TRANSPOSE-SIGN` | keeps the sign when moving a term across = |
| `E-TRANSPOSE-DIVIDE` | moves a coefficient across by subtracting instead of dividing |
| `E-BOTH-SIDES-ONE` | performs an operation on one side only |
| `E-DIST-PARTIAL` | distributes to the first term only |
| `E-LCM-PARTIAL` | multiplies only some terms by the LCM |
| `E-CROSS-WRONG` | cross-multiplies incorrectly |
| `W-SETUP-REVERSE` | reverses the relation ("5 less than x" becomes 5 - x) |

## Phase 3: Student PWA (27 to 28 Oct)

- [x] **3.1 Data layer.** Dexie tables (7.3), event writer with UUID and `sessionId`, state cache with replay-on-mismatch, `ApiClient` wiring with `LocalDemoApiClient` first (seed from 6.1 can be a 2-student stub until 6.1 lands).
- [x] **3.2 Profiles.** Student login (classroom code + roll + PIN), shared-device profile switcher, PIN hashing with WebCrypto, per-profile language.
- [x] **3.3 Readiness screen.** Runs `readiness.ts` interactively; progress indicator "question 5 of up to 12"; on completion writes `readiness_completed` and shows a two-line summary in the student's language.
- [x] **3.4 Home card.** Calls `nextRecommendation`; shows mode, concept, and the rendered reason; one primary button. Shows due re-checks as the first card.
- [x] **3.5 Learn.** Renders the chosen resource (markdown subset + SVG), bilingual toggle, "I understood, let me try" writes `learn_viewed`.
- [x] **3.6 Solve.** One question at a time, MCQ and numeric input, hint button (counts `hintsUsed`), immediate feedback with the solution, ladder visible as three dots, writes `attempt`.
- [x] **3.7 Test, re-check, verify.** Three questions, no hints, result screen with mastery outcome and what happens next.
- [ ] **3.8 Progress.** Concepts grouped by class with mastery bars, mastered dates, next re-check dates.
- [ ] **3.9 Offline.** Workbox precache + pack cache; "downloaded for offline" indicator; manual test with DevTools offline passes the full loop.
- [ ] **3.10 Sync queue and HttpApiClient.** Batch unsynced events on reconnect and on app open; retry with backoff; sync status chip. (Depends on 4.4.)

## Phase 4: API (28 Oct) — P1

- [ ] **4.1 Prisma schema and seed.** Models from 8.3; migration; seed script creating one school, two classrooms (Class 8 B with 46 students, Class 9 A with 40), one teacher, one coordinator.
- [ ] **4.2 Auth.** Teacher login (Argon2id), student login, refresh, `authz` plugin with tests for cross-classroom denial.
- [ ] **4.3 Packs.** `GET /packs/:chapterId` from `apps/api/packs/` with ETag.
- [ ] **4.4 Sync.** Per 8.2: zod validation, idempotent insert, replay with `@setu/engine`, materialise `MasteryState` and `Recheck`. Test: golden vectors from 1.8 replayed through the API produce identical state.
- [ ] **4.5 Teacher reads.** gapmap, groups, evidence, weekly, built from events via the engine.
- [ ] **4.6 Teacher writes.** `POST /classrooms/:id/events` for override, mark taught, assign, extension lock, group edit, paper attempts; `POST /classrooms/:id/launch`.

## Phase 5: Teacher app (28 to 29 Oct)

- [x] **5.1 Login and classrooms list.** Works with both ApiClients.
- [x] **5.2 Gap Map.** Heatmap for up to 60 rows: prerequisite columns left, chapter columns right, colour scale on `pKnown`, null as grey, sticky student column, tap cell opens the evidence drawer (attempts, chosen answers, misconception labels).
- [x] **5.3 Groups.** Cards per `GapGroup` with student chips, dominant misconception, three most-missed questions shown inline for the warm-up; accept / dismiss / move student / merge / split, each writing a `group_edit` event.
- [x] **5.4 Actions.** Mark taught (group), assign (group or student), override with note (student page), lock/unlock extension. Confirmation toasts state the consequence ("re-check scheduled for 15 students").
- [x] **5.5 Launch chapter.** Chapter picker (shows Class 7, 8, 9, 10 chapters), prerequisite list with remove toggles, "Print paper check" generating a printable page of 12 difficulty-2 questions covering the external prerequisites.
- [ ] **5.6 Paper entry.** Grid student x question; tap cycles correct / wrong option (a, b, c, d) / blank; submits `attempt` events with `source: paper`.
- [ ] **5.7 Weekly view.** Movement between groups, blocking concepts, re-check pass rates after mark taught.

## Phase 6: Demo, evaluation and evaluator deliverables (29 Oct)

- [x] **6.1 Demo seed.** `packages/content/src/demo/seed.ts`: Anjali and Ravi exactly as in the submission section 2.4, plus 44 synthetic students generated by simulating learners with planted gaps through the engine (seeded). Produces the event log that `LocalDemoApiClient` loads. `/demo` route loads it and lands on the teacher Gap Map.
- [ ] **6.2 Simulation report.** `pnpm sim`: 1,000 synthetic students, planted single and double gaps, learners with three learning rates; reports root-cause recall and precision within 12 items, median items used, items-to-mastery and share of attempts in the 60 to 80 percent accuracy band for ladder vs fixed difficulty. Writes `docs/EVALUATION.md` with tables. Target recall at least 0.85 for single gaps.
- [ ] **6.3 Deployment plan.** `docs/DEPLOYMENT.md`: reference deployment (one small VM in an Indian region + managed Postgres or Postgres on the VM, object storage for packs), monthly cost table for 1, 5, 25 schools in INR with assumptions, school onboarding checklist (accounts, consent via school, classroom codes, pack download day), teacher training plan (90-minute session, two 30-minute follow-ups, one-page quick card), support model, backup and data retention. Honest limits section.
- [ ] **6.4 Teacher wireframes.** `docs/wireframes/`: low-fidelity wireframes as simple HTML files (no build step) for Launch, Gap Map, Evidence drawer, Groups, Mark taught confirmation, Weekly; plus PNG screenshots of the built screens from demo mode; `README.md` in the folder with the five-minute-before-class walkthrough.
- [ ] **6.5 Scaling walkthrough.** `docs/SCALING.md`: add a chapter (JSON diff, validator output, pack size), add a board tag, add a language, add a subject; and a demo recipe: launch Class 9 LE2V in Class 9 A and show the Readiness Check descending into Class 8 and 7.
- [ ] **6.6 Demo script.** `docs/DEMO_SCRIPT.md`: 6-minute Prove-round walkthrough (teacher launch, Anjali vs Ravi, Gap Map, mark taught, re-check, offline toggle, Class 9 scaling moment).
- [ ] **6.7 README polish.** Screenshots, quick start, architecture summary, link to all docs.
- [ ] **6.8 Release.** Verify GitHub mirror is current, tag `v0.1.0`, GitHub Actions green.

## Phase 7: Stretch (only after 6.8)

- [ ] 7.1 Python `sim/` with pyBKT fitting on exported synthetic logs.
- [ ] 7.2 IndicTrans2 drafting script producing `machine_draft` Telugu/Hindi for review.
- [ ] 7.3 Capacitor wrapper build.
- [ ] 7.4 Virtualised Gap Map for 100+ rows.
