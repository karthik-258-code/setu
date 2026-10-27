# Setu Architecture (Build round, v0.1)

This document is the source of truth for how Setu is built. Coding agents and humans read this before writing code. `packages/engine/src/types.ts` is the executable form of sections 5 and 6; if the two disagree, fix both in the same commit.

Background: [problem statement](hackathon/01-problem-statement.md), [Decode submission](hackathon/02-decode-submission.md), [Decode results](hackathon/03-decode-results.md).

---

## 1. Scope of v0.1

**Goal of the Build round:** a working, demonstrable loop for one chapter at full depth, with the graph and engine visibly extending across Classes 6 to 10.

In scope:

- Student PWA (offline-first): Readiness Check, Learn, Solve, Test, spaced re-checks, shared-device profiles, English and Telugu.
- Teacher web app: launch chapter, Gap Map, evidence drawer, groups with suggested actions, overrides, mark taught, assign, paper entry, weekly view.
- One shared engine (`@setu/engine`) that runs identically in the browser and on the server.
- Content: full depth for **Class 8 Mathematics, Linear Equations in One Variable** plus its Class 6 and 7 prerequisite chain; skeleton depth for Class 7 *Simple Equations*, Class 9 *Linear Equations in Two Variables*, Class 10 *Pair of Linear Equations* so the same graph spans Classes 6 to 10.
- Thin API (Fastify, Prisma, PostgreSQL) for auth, content packs, sync and teacher views.
- **Demo mode** that runs the whole system in the browser without a server (risk control for the Prove round).
- Simulation report, deployment plan, teacher wireframes (the three evaluator asks).

Out of scope (by design, as in the submission): conversational tutor, runtime LLM calls, live machine translation shown to students, deep knowledge tracing, parent app, Play Store packaging.

---

## 2. System overview

```mermaid
flowchart LR
  subgraph Content["content/ (JSON, versioned in git)"]
    G[concept graph] --> B[pack builder]
    Q[questions + templates] --> B
    R[resources en/te] --> B
  end
  B --> P[(chapter packs *.json)]

  subgraph Web["apps/web (PWA)"]
    S[Student screens] --> E1[@setu/engine]
    T[Teacher screens] --> AC[ApiClient]
    E1 --> D[(Dexie / IndexedDB: events, state, packs)]
    AC -. demo mode .-> E1
  end

  subgraph Api["apps/api (Fastify)"]
    SY[/POST sync/] --> E2[@setu/engine replay]
    E2 --> PG[(PostgreSQL: events, mastery)]
    TV[/teacher views/] --> PG
    PK[/GET packs/] --> P
  end

  P --> D
  D -- events batch --> SY
  AC -- http mode --> TV
```

One sentence: **content is static JSON; a student's state is a fold over an append-only event log; the same pure engine computes that fold, the next recommendation and the teacher's Gap Map everywhere.**

---

## 3. Repository layout (pnpm workspaces)

```
setu/
  AGENTS.md                 rules for coding agents
  README.md
  docs/
    ARCHITECTURE.md         this file
    BUILD_PLAN.md           phased tasks
    DECISIONS.md            ADR-lite log
    DEPLOYMENT.md           school deployment, cost, teacher training (Phase 6)
    EVALUATION.md           simulation results (Phase 6, generated)
    SCALING.md              how a chapter/class/board is added (Phase 6)
    DEMO_SCRIPT.md          Prove-round walkthrough (Phase 6)
    wireframes/             teacher-facing wireframes + screenshots (Phase 6)
    hackathon/              problem statement, submission, results
  packages/
    engine/                 @setu/engine   pure TypeScript, zero runtime deps
    content/                @setu/content  content JSON, zod schemas, validator, template generators, pack builder
    shared/                 @setu/shared   API DTOs (zod) shared by web and api
  apps/
    web/                    React + Vite + Tailwind PWA (student and teacher routes)
    api/                    Fastify + Prisma + PostgreSQL
  sim/                      Python (stretch): pyBKT fitting notebooks
  docker-compose.yml        postgres + api for local dev
  .github/workflows/ci.yml  canonical CI (GitHub is the final home)
  .gitlab-ci.yml            mirror while hosted on GitLab
```

Dependency direction (never reversed): `engine <- content <- shared <- api | web`. The engine imports nothing from the workspace.

---

## 4. Core principle: event-sourced student state, one engine

- Every student action and teacher action is an **event** (`StudentEvent` in `types.ts`) with a client-generated UUID and a timestamp.
- `StudentState = replay(pack, events)` is a pure fold. The browser runs it over Dexie; the server runs it over PostgreSQL rows. Both use the same compiled function, so offline and online estimates are identical by construction.
- Sync is therefore trivial and idempotent: the client POSTs unsynced events; the server inserts by id (ignore duplicates), replays affected students, and materialises `MasteryState` rows for teacher queries.
- The engine is **pure and deterministic**: no `Date.now()`, no `Math.random()`, no I/O. Callers pass `now: string` (ISO) and `rng: () => number` (seeded `mulberry32` from `engine/src/rng.ts`).
- Every recommendation carries a `ruleId` and `reasonParams`; the UI renders the plain-language reason from the pack's `reasonTemplates` in the student's language. The engine never contains user-facing strings.

---

## 5. Engine (`@setu/engine`)

### 5.1 Modules and public API

| File | Exports | Notes |
|---|---|---|
| `types.ts` | all shared types and constants | the contract |
| `rng.ts` | `mulberry32(seed): () => number`, `pick(rng, arr)`, `shuffle(rng, arr)` | |
| `graph.ts` | `buildGraph(concepts, chapters): ConceptGraph`, `assertDag(graph)`, `directPrereqs(graph, id)`, `ancestors(graph, id)`, `descendants(graph, id)`, `chapterExternalPrereqs(graph, chapterId): ConceptId[]`, `frontier(graph, mastery, scope, threshold)`, `rootCauseGap(graph, mastery, chapterId): ConceptId \| null` | `topoOrder` computed once by Kahn's algorithm, tie-break by `classLevel` then id |
| `bkt.ts` | `bktUpdate(pKnown, correct, params): number`, `priorFromPrerequisites(graph, conceptId, mastery, params): number`, `paramsFor(concept): BktParams` | |
| `replay.ts` | `initialState(studentId): StudentState`, `applyEvent(pack, state, event): StudentState`, `replay(pack, events, studentId): StudentState` | reducer; events sorted by `ts` (as instants) then `id` before folding; events of other students are ignored by `replay` |
| `readiness.ts` | `startReadiness(pack, state, chapterId, trimmed): ReadinessSession`, `nextReadinessQuestion(pack, session, rng): { session, question: Question \| null }`, `recordReadinessAnswer(pack, session, attempt): ReadinessSession`, `readinessSummary(session, now): ReadinessSummary` | functions only manage the diagnostic; the caller writes the `attempt` events (mode `readiness`) and the final `readiness_completed` event |
| `ladder.ts` | `nextDifficulty(progress, lastAttempt): Difficulty`, `ladderMove(progress, lastAttempt): "up" \| "down" \| "hold"`, `startingDifficulty(state, pack, chapterId, conceptId): Difficulty` | `progress` already includes `lastAttempt` in its streaks; used by `replay.ts` |
| `policy.ts` | `nextRecommendation(ctx: PolicyContext): Recommendation` | |
| `recheck.ts` | `scheduleSpaced(conceptId, masteredAt): Recheck[]`, `dueRechecks(state, now): Recheck[]` | |
| `grouping.ts` | `buildGapMap(pack, chapterId, students): GapMap`, `buildGapGroups(pack, chapterId, students, attemptsByStudent): GapGroup[]` | |
| `selectQuestions.ts` | `selectQuestions(pack, conceptId, difficulty, exclude, n, rng, opts?: { tag?: QuestionTag }): Question[]` | exact difficulty first, unseen before seen, seen least-recently-seen first (earliest in `exclude`), then nearest difficulty |
| `index.ts` | re-exports | |

### 5.2 Bayesian Knowledge Tracing

One two-state model per concept. Defaults (`DEFAULT_BKT`): `pL0 = 0.3, pT = 0.2, pG = 0.2, pS = 0.1`; a concept may override via `Concept.bkt`.

```
posterior_correct = pL(1-pS) / (pL(1-pS) + (1-pL)pG)
posterior_wrong   = pL·pS    / (pL·pS    + (1-pL)(1-pG))
pL'               = posterior + (1 - posterior)·pT
```

Prior when a concept is first touched: `pL0_adj = clamp(pL0 × (0.4 + 0.6 × minPrereq), 0.05, 0.95)` where `minPrereq` is the minimum `pKnown` over direct prerequisites (use `pL0` for prerequisites never seen). A concept with no prerequisites uses `pL0`.

Mastery: `pKnown >= MASTERY_THRESHOLD (0.9)`. `masteredAt` is set the first time the threshold is crossed **in Test or Re-check mode**, not in Solve.

### 5.3 Chapter Readiness Check (adaptive graph-traversal diagnostic)

Budget `READINESS_MAX_ITEMS = 12`, depth `READINESS_MAX_DEPTH = 3`. Questions are difficulty 2 unless noted. Each answer also updates BKT (mode `readiness`).

1. **Direct phase.** `targets = chapterExternalPrereqs(graph, chapterId) minus trimmed` (teacher-removed), ordered by impact = number of chapter concepts that transitively depend on the prerequisite (desc), then topo order. Ask **one** question per target.
2. **Descend phase.** For each target answered wrong: status `failed`; push its direct prerequisites (depth+1, if `<= 3` and not already asked/cleared) to the **front** of the queue, ordered by impact. Ask one question each; recurse on wrong answers.
   A concept answered correctly once (and never wrong) has status **`cleared`** immediately. One correct answer is enough evidence to stop descending that branch; BKT already records the lower confidence of a single answer.
3. **Chapter phase.** Runs **before** confirm. If no target is `failed` or `uncertain` and budget `>= 2`: ask two chapter questions (difficulty 2, from the first two chapter concepts in topo order). Both correct: `advancedEntry = true`. Students with any failure skip this phase.
4. **Confirm phase.** With whatever budget remains, ask a second question to each concept answered correctly exactly once (closest to the chapter first, that is lowest depth, then impact). Correct again: stays `cleared`. Wrong: becomes `uncertain`, and descend into its prerequisites if depth and budget allow.
5. Stop when budget is exhausted or nothing is left. Concepts never reached stay `pending` and are treated as unknown (prior only).

Budget check for `CH.M8.LINEAR_EQ_ONE_VAR` (7 external prerequisites): an all-correct student uses 7 direct + 2 chapter + 3 confirm = 12 and can reach `advancedEntry`; a student like Ravi spends the budget on descents and confirmations and never sees chapter questions.

Output `ReadinessSummary` is stored as a `readiness_completed` event, so replay reproduces it.

### 5.4 Pathway and difficulty policy (rules, in priority order)

`nextRecommendation(ctx)` evaluates these in order and returns the first that fires. Each rule has a stable `ruleId` that maps to a bilingual template in the pack.

| Rule | Fires when | Output |
|---|---|---|
| `R0_READINESS` | chapter has no `readiness` summary for this student | `mode: readiness` |
| `R1_VERIFY_OVERRIDE` | a `verify_override` re-check is due | `mode: verify`, 3 questions at difficulty 2 |
| `R2_RECHECK_DUE` | a `spaced` or `after_taught` re-check is due (at most one per session) | `mode: recheck`, 3 questions |
| `R3_ASSIGNED` | teacher assigned a concept not yet mastered | proceeds with the assigned concept through R5 to R7 |
| `R4_FRONTIER` | pick concept = first of `frontier(graph, mastery, scope = chapter concepts ∪ their ancestors, 0.9)` in order: lowest `classLevel`, then topo order | sets `conceptId` for R5 to R7 |
| `R5_LEARN` | `progress.learnViewed == false` and `pKnown < LEARN_SKIP_THRESHOLD (0.7)` and readiness did not clear it | `mode: learn`; resource = `worked_example` whose `targetsMisconception` equals the student's most recent misconception on this concept or its ancestors, else the concept's `explanation` |
| `R6_TEST` | `progress.solveAttempts >= 4` and `pKnown >= TEST_READY_THRESHOLD (0.8)` and not yet mastered | `mode: test`, 3 unseen questions at current difficulty, hints disabled |
| `R7_SOLVE` | otherwise for the chosen concept | `mode: solve`, 1 question at `nextDifficulty(...)` |
| `R8_EXTENSION` | frontier empty, all chapter concepts mastered, `extensionLocked == false` | `mode: extension`, difficulty 3 questions tagged `extension` |
| `R9_DONE` | nothing else | `mode: done` |

**Difficulty ladder** (`ladder.ts`): start at 1, or 2 if Learn was skipped or `advancedEntry`. Up one (max 3) after two consecutive correct with `hintsUsed == 0`. Down one (min 1) after two consecutive wrong **or** any attempt carrying a `misconceptionCode`; a down-move also sets `progress.learnViewed = false` so R5 shows a targeted worked example next. `progress.difficulty` is derived state: replay applies the ladder after every `solve` or `extension` attempt (and a down-move also resets both streaks), and creates a concept's progress at `startingDifficulty(state, pack, chapterId, conceptId)`; the policy reads `progress.difficulty` and never recomputes it.

**Test outcome:** after the 3 test attempts, if `pKnown >= 0.9` the concept is mastered (`masteredAt = now`, spaced re-checks scheduled). Otherwise back to Solve at difficulty `max(1, current - 1)`. Replay applies this when `testAttempts` reaches `TEST_QUESTIONS`: if not mastered it sets the difficulty and resets `solveAttempts` and `testAttempts` to 0; if mastered it resets `testAttempts` only. Spaced re-check scheduling is task 1.6.

**Re-check outcome:** `pKnown < 0.9` after a re-check reopens the concept (`masteredAt` cleared, difficulty 1, `learnViewed = false`).

**Teacher override** (`teacher_override` event): sets `pKnown = 0.9`, `source = teacher_override`, `pendingVerification = true` and schedules a `verify_override` re-check for the next session. The model's estimate just before the override is kept in `MasteryState.modelPKnown` (present only while `pendingVerification` is true); failing verification restores it and clears the flag. `teacher_override` with `mastered = false` sets `source = teacher_override`, `pKnown = min(current, 0.3)` and clears `masteredAt`. **Mark taught** schedules an `after_taught` re-check (`dueAt = now`) for every student in the group.

### 5.5 Spaced re-checks

`RECHECK_INTERVALS_DAYS = [2, 7, 21]` from `masteredAt`. Passing a re-check advances to the next interval; failing reopens the concept and restarts the schedule after it is re-mastered.

### 5.6 Gap Map and groups

- **Gap Map:** columns = `chapterExternalPrereqs ∪ their ancestors (topo order)` then chapter concepts; rows = students; cell = `pKnown` or `null` if never touched.
- **Root cause gap** per student: among unmastered concepts in the chapter's ancestor set, choose the one whose own direct prerequisites are all mastered or untouched (the most upstream blocker); tie-break lowest `classLevel`, then topo order.
- **Groups:** `ready` (root cause null and readiness done), `not_attempted` (no readiness summary), one `gap` group per root-cause concept. Keep `ready`, `not_attempted` and the three largest `gap` groups; merge the rest into one `other` group. Never more than `MAX_GROUPS = 5`.
- Each `gap` group carries `dominantMisconception` (most frequent code over the group's attempts on that concept) and `suggestedQuestionIds` (the three most-missed questions on that concept), and a `suggestedAction`: `warm_up` if the group is `>= 25%` of the class, else `small_group`; `paper_check` for `not_attempted`; `extension` for `ready`.

### 5.7 Testing the engine

- Unit tests with hand-computed BKT values (to 6 decimals).
- Golden vectors in `packages/engine/test/golden/*.json`: `(pack fixture, events) -> StudentState`; the same files are loaded by the API test suite so server and browser agree.
- Property tests: `assertDag` rejects cycles; readiness never exceeds 12 items; policy always returns a rule; replay is order-independent for events with distinct `ts`.
- Simulation (`pnpm sim`): synthetic students with planted gaps; reports recall and precision of root-cause detection and median items used. Output written to `docs/EVALUATION.md`.

---

## 6. Content model

### 6.1 Identifiers

- Concept: `M{class}.{TOPIC}.{NAME}` e.g. `M6.FRAC.ADD_SUB_UNLIKE`, `M8.LEQ.BOTH_SIDES`.
- Chapter: `CH.M{class}.{NAME}` e.g. `CH.M8.LINEAR_EQ_ONE_VAR`.
- Question: `{conceptId}.Q{nn}` for hand-authored, `{conceptId}.T{template}.{seed}` for generated.
- Resource: `{conceptId}.R.{type}.{nn}`; misconception-targeted worked examples add `.{CODE}`.
- Misconception codes: `F-*` fractions, `I-*` integers, `A-*` algebraic expressions, `E-*` equations, `W-*` word problems. Initial set is in `content/misconceptions.json` (see BUILD_PLAN 2.2).

### 6.2 Files

```
packages/content/
  content/
    graph/concepts.json          all concepts (Classes 6 to 10 spine), prerequisites inline
    graph/chapters.json          chapters, depth: full | skeleton
    misconceptions.json          code -> label (en, te), teacherNote
    reasons.json                 ruleId -> template (en, te) with {placeholders}
    questions/<conceptId>.json   hand-authored questions
    templates/<conceptId>.json   parametric templates
    resources/<conceptId>.json   explanations, worked examples, hints (en, te)
  src/
    schema.ts                    zod schemas mirroring engine types
    generators/*.ts              one generator per template id; distractors computed with misconception codes
    validate.ts                  DAG, coverage, bilingual, review-status rules
    build.ts                     writes apps/web/public/packs/<chapterId>.json and apps/api/packs/
```

### 6.3 Pack contents and rules

A pack for chapter C contains the **whole graph** (it is tiny) plus questions and resources for `C's concepts ∪ ancestors(C)`. Target size 3 to 5 MB uncompressed; SVG diagrams inline, no raster images, no video.

Validation (`pnpm content:validate`) fails the build if:

- the graph has a cycle, or a prerequisite points to an unknown concept;
- any concept of a `full` chapter, or any of its ancestors, has fewer than 6 questions spanning all three difficulties, or lacks an `explanation` with both `en` and `te`;
- any concept of a `skeleton` chapter has fewer than 3 questions or no `en` explanation;
- any `reviewStatus: machine_draft` item exists (drafts must be promoted to `draft` or `reviewed` by a human before build);
- a `ruleId` used by the engine has no template in `reasons.json`.

Language fallback is explicit: if `te` is missing, the UI shows `en` with a small "English only" marker; nothing is auto-translated at runtime.

### 6.4 Templates

A template declares a `generator` id and a parameter space; the generator produces `Question` objects deterministically from a seed, including distractors with misconception codes (for example `add_unlike_fractions` yields distractor `(a+c)/(b+d)` tagged `F-ADD-DENOM`). This is how 120 hand-authored items become roughly 300 without hand-writing every variant. Generated questions carry the template's `reviewStatus`.

### 6.5 Graph scope for v0.1 (the scalability story)

The graph is one DAG across Classes 6 to 10 on the algebra spine. Full-depth content exists for `CH.M8.LINEAR_EQ_ONE_VAR` and everything upstream of it; skeleton content exists for the Class 7, 9 and 10 chapters so a teacher can **launch a Class 9 chapter and watch the Readiness Check reach into Class 8, 7 and 6**. The concept list and edges are specified in BUILD_PLAN task 2.1. Adding a chapter is adding JSON and running the validator; see `docs/SCALING.md` (Phase 6).

---

## 7. Web app (`apps/web`)

### 7.1 Stack

React 18, TypeScript, Vite, Tailwind CSS, `vite-plugin-pwa` (Workbox), Dexie for IndexedDB, TanStack Router or React Router (pick one in Phase 0 and record it in DECISIONS.md), Zustand for small UI state. Bundle budget: **1 MB gzipped JS**, enforced in CI.

### 7.2 Routes

```
/                      role chooser (student / teacher / demo)
/demo                  loads the demo classroom into Dexie and switches ApiClient to LocalDemoApiClient

/s/login               classroom code + roll number + 4-digit PIN; add profile to this device
/s/profiles            switch profile on a shared device
/s/home                today's card: recommendation + reason, language toggle
/s/readiness/:chapterId
/s/learn/:conceptId
/s/solve/:conceptId
/s/test/:conceptId     also used for recheck and verify
/s/progress            concepts with mastery bars, grouped by class level

/t/login
/t/classrooms
/t/classrooms/:id/launch           pick chapter, trim prerequisites, print paper check
/t/classrooms/:id/gapmap           heatmap, tap cell -> evidence drawer
/t/classrooms/:id/groups           today's groups, accept/edit/merge/split/dismiss, actions
/t/classrooms/:id/students/:sid    one student: pathway, attempts, override
/t/classrooms/:id/paper-entry      grid: student x question, tap to mark
/t/classrooms/:id/weekly           movement between groups, blocking concepts, re-check results
```

### 7.3 Offline storage (Dexie)

| Table | Key | Purpose |
|---|---|---|
| `profiles` | `studentId` | name, roll, classroomId, `pinHash` (SHA-256 with per-device salt via WebCrypto), `lang` |
| `packs` | `chapterId` | the ContentPack JSON and `packVersion` |
| `events` | `id` | all `StudentEvent`s, `synced: 0/1`, indexed by `[studentId+ts]` |
| `states` | `studentId` | cached `StudentState` (recomputed by replay on load if `eventCount` mismatches) |
| `meta` | key | deviceId, salt, last sync |

The service worker precaches the app shell and caches `/packs/*.json` with a cache-first strategy keyed by `packVersion`.

### 7.4 `ApiClient` and demo mode

All network access goes through one interface:

```ts
// packages/shared/src/api-client.ts; DTO types are inferred from the zod schemas in @setu/shared
interface ApiClient {
  login(request: TeacherLoginRequest): Promise<TeacherLoginResponse>;
  studentLogin(request: StudentLoginRequest): Promise<StudentLoginResponse>;
  getMyState(): Promise<StudentState>;
  getPack(chapterId): Promise<ContentPack>;
  sync(events: StudentEvent[]): Promise<{ accepted: string[]; rejected: { id: string; reason: string }[]; serverTime: string }>;
  getClassrooms(): Promise<ClassroomSummary[]>;
  launchChapter(classroomId, request: LaunchRequest): Promise<LaunchResponse>;
  getGapMap(classroomId, chapterId): Promise<GapMap>;
  getGroups(classroomId, chapterId): Promise<GapGroup[]>;
  getEvidence(classroomId, studentId, conceptId): Promise<AttemptEvent[]>;
  postTeacherEvent(classroomId, event: TeacherEvent): Promise<void>;
  getWeekly(classroomId, chapterId): Promise<WeeklyView>;
}
```

`HttpApiClient` talks to `apps/api`. `LocalDemoApiClient` runs the same engine functions over a seeded classroom (Anjali, Ravi and 44 synthetic students) stored in Dexie. The Prove-round demo must work end to end with `LocalDemoApiClient` alone; the API is the production path, not a demo dependency.

---

## 8. API (`apps/api`)

### 8.1 Endpoints

```
POST /auth/teacher/login                     {email, password} -> {accessToken, refreshToken}
POST /auth/student/login                     {classroomCode, rollNo, pin} -> {accessToken, student}
POST /auth/refresh
GET  /packs/:chapterId                       ContentPack (ETag / If-None-Match)
GET  /me/state                               StudentState (restore on a new device)
POST /sync                                   {deviceId, events[<=200]} -> {accepted[], rejected[{id, reason}], serverTime}
GET  /classrooms                             teacher's classrooms
POST /classrooms/:id/launch                  {chapterId, trimmed[]}
GET  /classrooms/:id/gapmap?chapterId=
GET  /classrooms/:id/groups?chapterId=
GET  /classrooms/:id/students/:sid/evidence?conceptId=
POST /classrooms/:id/events                  TeacherEvent (override | mark_taught | assign | extension_lock | paper_attempt)
GET  /classrooms/:id/weekly?chapterId=
GET  /health
```

Auth: JWT access token (15 min) + refresh token (30 days), roles `student | teacher | coordinator`. Teachers act only on classrooms in `TeacherAssignment`; students read and write only their own `studentId`. Teacher passwords hashed with Argon2id.

### 8.2 Sync protocol

1. Client selects up to 200 events with `synced = 0`, ordered by `ts`.
2. `POST /sync`. Server validates each event with the shared zod schema, inserts with `ON CONFLICT (id) DO NOTHING`, and records a `SyncBatch`.
3. For each affected student the server loads all events, runs `replay`, and upserts `MasteryState` and `Recheck` rows (write-through materialisation).
4. Response lists accepted ids; client marks them `synced = 1`. Rejected events are returned with reasons and kept for inspection, never silently dropped.

Paper entry is just the teacher posting `attempt` events with `mode: readiness` and `source: paper` on behalf of a student.

### 8.3 Data model (Prisma)

```
School(id, name, board, district)
Classroom(id, schoolId, classLevel, section, code UNIQUE, launchedChapters Json)
Teacher(id, schoolId, name, email UNIQUE, passwordHash, role)
TeacherAssignment(teacherId, classroomId)            @@id([teacherId, classroomId])
Student(id, classroomId, firstName, rollNo, pinHash, lang)   @@unique([classroomId, rollNo])
Device(id, label, lastSeenAt)
Event(id, studentId, type, payload Json, ts, receivedAt, deviceId?, teacherId?)   source of truth
MasteryState(studentId, conceptId, pKnown, attempts, masteredAt?, source, updatedAt) @@id([studentId, conceptId])
Recheck(id, studentId, conceptId, dueAt, kind, done)
SyncBatch(id, deviceId, eventCount, receivedAt)
```

Content is **not** stored in PostgreSQL in v0.1; packs are files served by the API (and by the web app's `public/packs` for demo and offline). Student PII is limited to `firstName` and `rollNo`.

---

## 9. Teacher workflow to screen mapping

| Submission step | Screen | Engine call |
|---|---|---|
| Launch a chapter, trim prerequisites | `/t/.../launch` | `chapterExternalPrereqs` |
| Gap Map, tap cell for evidence | `/t/.../gapmap` | `buildGapMap`, evidence = attempts filtered by concept |
| Today's groups with suggested 10-minute activity | `/t/.../groups` | `buildGapGroups` |
| Accept / edit / merge / split / dismiss | `/t/.../groups` | UI-side edits stored as a `group_edit` teacher event (for the weekly view and audit) |
| Override mastery | student page | `teacher_override` event |
| Mark taught | groups | `mark_taught` event per student |
| Assign concept or questions | groups, student page | `assign` event |
| Lock / unlock extension | student page | `extension_lock` event |
| Paper Readiness Check | `/t/.../launch` (print), `/t/.../paper-entry` (enter) | `attempt` events with `source: paper` |
| Weekly view | `/t/.../weekly` | group membership diff between two dates, re-check pass rates after `mark_taught` |

---

## 10. Answering the evaluator's three asks

1. **Scalability across Classes 6 to 10:** one graph spanning the algebra spine (section 6.5), skeleton chapters in Classes 7, 9 and 10 that are launchable in the teacher app, and `docs/SCALING.md` showing the exact steps and validator output for adding a chapter, a board tag and a language.
2. **Real-school deployment plan:** `docs/DEPLOYMENT.md` with a single-VM Indian-region reference deployment, monthly cost at 1, 5 and 25 schools, a one-page teacher onboarding plan (90-minute session plus two follow-ups), device and connectivity assumptions, and a pilot timeline.
3. **Visible teacher workflow:** `docs/wireframes/` with low-fidelity wireframes for Launch, Gap Map, Evidence drawer, Groups, Mark taught and Weekly, plus screenshots of the built screens from demo mode.

---

## 11. Quality gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm content:validate`, `pnpm build` all green in CI (GitHub Actions is canonical; GitLab CI mirrors it).
- Engine coverage target 90% lines; golden vectors shared with the API tests.
- Lighthouse PWA installable; works with network disabled after first load and pack download.
- Bundle budget 1 MB gzipped JS enforced in CI.

---

## 12. Security and privacy essentials in code

- No student field other than `firstName`, `rollNo`, `classroomId`, `lang`, `pinHash`. Adding a student PII field requires a DECISIONS.md entry.
- No third-party analytics, fonts or CDNs in the student app (offline and privacy).
- All teacher actions are events: who, what, when, with optional note.
- Access checks live in one Fastify plugin (`apps/api/src/plugins/authz.ts`) and are tested.

---

## 13. Glossary

- **Frontier:** concepts whose prerequisites are all mastered but which are not themselves mastered.
- **Root-cause gap:** the most upstream unmastered concept blocking a chapter for a student.
- **Pack:** the JSON bundle a student device downloads for one chapter.
- **Event:** an immutable record of a student or teacher action; the only thing that is synced.
- **Replay:** folding events into `StudentState` with the engine.
