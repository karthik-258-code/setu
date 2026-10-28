# Scaling walkthrough

Setu grows by adding **content**, not code. The engine (`packages/engine`) knows nothing about Class 8 or Linear Equations: it reads a concept graph, questions and resources from a pack. This page shows the four common extensions and a demo recipe. File layout and id rules are in [ARCHITECTURE](ARCHITECTURE.md) section 6.

## 1. Add a chapter

Example: Class 9 *Polynomials*, which already exists as a skeleton chapter and needs to become a full one.

**1a. Concepts and chapter** in `packages/content/content/graph/`. Each concept names its direct prerequisites; edges may point into any earlier class.

```diff
 // graph/concepts.json
+  {
+    "id": "M9.POLY.ZEROES",
+    "classLevel": 9,
+    "subject": "math",
+    "chapterId": "CH.M9.POLYNOMIALS",
+    "title": { "en": "Zeroes of a polynomial", "te": "బహుపది శూన్యాలు" },
+    "prerequisites": ["M9.POLY.CONCEPT", "M8.LEQ.ONE_SIDE"],
+    "boardTags": ["NCERT", "TS_SCERT"]
+  }

 // graph/chapters.json, CH.M9.POLYNOMIALS
-  "conceptIds": ["M9.POLY.CONCEPT"],
-  "depth": "skeleton"
+  "conceptIds": ["M9.POLY.CONCEPT", "M9.POLY.ZEROES"],
+  "depth": "full"
```

**1b. Questions, templates and resources**: `questions/M9.POLY.ZEROES.json`, optional `templates/M9.POLY.ZEROES.json`, and an explanation plus worked examples in `resources/`. Every student-facing string has `en` and `te`; wrong options carry a misconception code from `misconceptions.json`.

**1c. Validate and pack.**

```
pnpm content:validate
pnpm content:pack
```

The validator fails loudly and names the file. Typical messages while a chapter is half-done:

```
graph/concepts.json: concept M9.POLY.ZEROES has an unknown prerequisite M9.POLY.DEGREE
questions/M9.POLY.ZEROES.json: concept M9.POLY.ZEROES needs at least 2 questions at difficulty 3
questions/M9.POLY.ZEROES.json: M9.POLY.ZEROES.Q04 option b uses unknown misconception P-ZERO-SIGN
```

When it passes, `pnpm content:pack` prints one line per chapter (size, question counts, resources, version) and fails without writing anything if a pack is over 5 MB. A full chapter with about 300 questions is well under 1 MB of JSON; a skeleton chapter is a few kilobytes. Packs are versioned by content hash, so only changed chapters are downloaded again.

Nothing in `apps/web` or `apps/api` changes: the Launch screen lists the chapter, the Readiness Check walks its prerequisites, and the Gap Map adds its columns.

## 2. Add a board tag

Boards are tags on concepts, chapters and questions (`NCERT`, `TS_SCERT`). To add, say, the Andhra Pradesh board:

1. Add `"AP_SCERT"` to the `Board` type in `packages/engine/src/types.ts`, update ARCHITECTURE in the same commit and add a DECISIONS line (AGENTS.md rule for type-contract changes).
2. Add the tag to the zod schema in `packages/content/src/schema.ts`.
3. Tag the concepts and questions that apply. Most of the graph is shared across boards; only the chapter order and a few questions differ.

## 3. Add a language

`LocalizedText` already has `en`, `te` and `hi`. For Hindi:

1. **UI chrome:** add `hi` to every entry in `apps/web/src/i18n/strings.ts` and add it to `LANGUAGES`.
2. **Content:** add `hi` to questions, resources, reason templates and misconception labels. Optional: the offline drafting script (BUILD_PLAN 7.2) produces `machine_draft` text, which the validator refuses until a human reviewer promotes it to `draft` or `reviewed`.
3. **Fallback:** until a string is translated, students see the English text with an "English only" marker; nothing is translated at runtime.

## 4. Add a subject

The engine is subject-agnostic; `subject` is a field on concepts and chapters.

1. Widen the `subject` type (type-contract change, as in section 2) and the content schema.
2. Add a concept graph for the subject (for example Class 8 Science, *Force and Pressure*, with prerequisites in Classes 6 and 7), its questions, resources and misconception codes.
3. Add the subject's misconception families to `misconceptions.json` and reason templates stay as they are, because they speak about concepts, not about maths.

## 5. Demo recipe: Class 9 in the same app

1. Open `/demo`, then **Back** to the classrooms list and **Launch a chapter**.
2. Pick Class 9 *Linear Equations in Two Variables*. The prerequisite list shows Class 8 and Class 7 concepts pulled from the shared graph.
3. Tap **Print paper check** to show the 12-question sheet for those prerequisites, then **Launch**.
4. On the student tab, sign in as Ravi: his Readiness Check starts on the Class 9 prerequisites and, because of his fraction gap, descends into Class 8 and Class 7.
5. The content tests check this path automatically: a Class 9 two-variable check reaches the relevant Class 8 and Class 7 concepts within 12 questions, and a Class 10 pair-of-equations check reaches Class 9 and Class 8 (`packages/content/test`).
6. Relaunch the Class 8 chapter afterwards to restore the demo.

The demo seed contains one classroom (Class 8 B); a separate Class 9 A classroom with its own roster arrives with the API seed (BUILD_PLAN 4.1).
