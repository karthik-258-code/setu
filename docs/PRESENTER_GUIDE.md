# Presenter guide

Everything you need for the Prove round in one place: deploy, last tasks, what to say, what to show, and how to answer questions. The timed script itself is [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

## 1. Deploy for free on Render (demo mode)

Demo mode needs no backend: the whole classroom runs in the browser. That is the version to show.

1. Push `build/phase-6`, merge it into `main` (merge commit), wait for green CI.
2. On [render.com](https://render.com), sign in with GitHub, then **New > Blueprint** and pick `karthik-258-code/setu`. Render reads `render.yaml` and creates a static site called `setu`.
3. First build takes a few minutes. Open the URL Render gives you, then `/demo`.
4. Check three things on the live site: `/demo` lands on a 46-student Gap Map; `/s/login` with `DEMO8B`, roll `2`, PIN `2222` works; after one load, DevTools **Network > Offline** and a reload still work.
5. Put the URL at the top of the README and in the submission form.

If `/demo` says the classroom could not be loaded, open `https://<your-site>/demo/seed.json`: it must return JSON, not the app page. If it returns the page, delete the rewrite rule in the Render dashboard (**Redirects/Rewrites**) and add it again with source `/*` and destination `/index.html`.

The API (Phase 4) is optional for judging. Render's free Postgres expires after 30 days, so deploy the API only if a judge asks; demo mode shows the same engine.

## 2. Last tasks before submission

| Task | What to do |
|---|---|
| Screenshots (6.4, 6.7) | Phone-width browser (360 px) on `/demo`. Save PNGs to `docs/wireframes/screenshots/`: `gapmap.png`, `evidence.png` (tap one of Ravi's red cells), `groups.png`, `student-home.png` (Ravi), `learn.png`, `solve.png`. |
| Tick the plan | In `docs/BUILD_PLAN.md` change 6.4, 6.7 and 6.8 to `[x]`. |
| Merge | Merge request `build/phase-6` into `main`, merge commit, green CI. |
| Release (6.8) | `git checkout main`, `git pull`, `git tag v0.1.0`, `git push origin v0.1.0`; check GitHub shows the tag and Actions are green. |
| Live link | Render URL in README and submission. |

If the demo ever looks empty (for example after clearing site data), open `/demo` again: it reloads the seeded classroom.

## 3. The story in one minute

> In a Class 8 room of 46, the teacher starts Linear Equations. Some students are ready; others are stuck on something from Class 6, like adding fractions, and nobody knows until the chapter test. Setu finds that in ten minutes, before the chapter starts, on a shared phone with no internet. Each student gets their own path, and the teacher gets a one-screen map of who is stuck on what, with the wrong answers as proof. The teacher decides; Setu diagnoses, practises and re-checks.

## 4. What to show (six minutes)

Follow [DEMO_SCRIPT.md](DEMO_SCRIPT.md). The beats:

1. **Gap Map** (`/demo`): 46 students, prerequisites left, chapter right, red ring on each root gap.
2. **Evidence**: tap Ravi's red fraction cell: he answered 2/5 for 1/2 + 1/3, *adds denominators*. Every colour can be explained.
3. **Groups**: fraction group with three warm-up questions; accept, move one student, **Mark taught**: "Re-check scheduled for N students."
4. **Two students, one chapter**: Anjali goes straight to harder practice; Ravi gets a worked example built for his exact mistake, in Telugu with one tap.
5. **Solve and Test**: hints, the three-dot ladder, a three-question check with the mastery result and next re-check date.
6. **Offline**: DevTools offline, reload, keep working; events wait on the phone.
7. **Scaling**: Launch a chapter, pick Class 9, show prerequisites from Classes 8 and 7 and the printable 12-question paper check.

## 5. Why this wins (say these out loud)

- **It finds the cause, not the symptom.** The Readiness Check walks backwards through a concept graph from Class 10 down to Class 6 and names the earlier concept and the misconception, in at most 12 questions.
- **The teacher stays in charge.** Setu suggests groups and warm-ups; every accept, move, override and "mark taught" is the teacher's, and each one has a visible consequence.
- **It works where schools are.** Offline-first PWA on a shared phone, PIN profiles, Telugu and English, a printable paper check and paper entry for students without a device.
- **It closes the loop.** Mark taught schedules re-checks; spaced re-checks at 2, 7 and 21 days; the weekly view shows whether the lesson worked.
- **One engine everywhere.** The same pure TypeScript engine runs on the phone, in the API and in the simulation; golden vectors prove the server reproduces the phone exactly.
- **It scales by content, not code.** 7 chapters across Classes 6 to 10, about 1,100 questions (hand-written plus deterministic templates), all validated; adding a chapter is JSON ([SCALING.md](SCALING.md)).
- **It is honest.** A 1,000-learner simulation ([EVALUATION.md](EVALUATION.md)) reports where it falls short; costs, training and limits are written down ([DEPLOYMENT.md](DEPLOYMENT.md)).

## 6. Features at a glance

| Students | Teachers | Platform |
|---|---|---|
| Readiness Check, up to 12 questions | Gap Map heatmap with evidence drawer | Offline-first PWA, under 1 MB JS |
| Home card with the reason for the next step | Groups: accept, dismiss, move, merge, split | One engine on phone, API and simulation |
| Learn with Telugu/English toggle | Mark taught, assign, override with note | Event log as the source of truth |
| Solve with hints and difficulty ladder | Lock extension problems | Fastify + Prisma API, idempotent sync |
| Test, re-check, verification | Launch a chapter, trim prerequisites | Bilingual content packs with validator |
| Progress by class | Printable paper check and paper entry | Deterministic demo seed and simulation |
| Shared-phone profiles with PINs | Weekly view | Free static deploy on Render |

## 7. Questions judges may ask

- **"Is the data real?"** No. Anjali and Ravi follow the submission's story; 44 students are simulated through the real Readiness Check with planted gaps. A pilot is the next step.
- **"How accurate is the diagnosis?"** In simulation, 74% of single planted gaps are found within 12 items against our 85% target; we report it rather than hide it, and the fix is a deeper first probe on the highest-impact prerequisite.
- **"Why not an AI chatbot?"** No runtime AI: it must work offline on cheap phones, be explainable to teachers and cost nothing per student. Every recommendation has a rule and a reason.
- **"Who checks the Telugu?"** It is a first draft; a Telugu-medium maths teacher must review it before classroom use. The validator blocks machine drafts from shipping.
- **"What does it cost?"** About 3,500 rupees a month for one school, under 2 rupees per student per month at 25 schools ([DEPLOYMENT.md](DEPLOYMENT.md)).
- **"What about privacy?"** Only first name, roll number, class, language and a hashed PIN. No phone numbers or photos; consent through the school.
- **"How do you add a subject?"** Add a concept graph and questions; the engine is subject-agnostic ([SCALING.md](SCALING.md)).

## 8. Demo sign-ins

| Who | Sign in |
|---|---|
| Teacher | `teacher@demo.setu.app` / `setu-demo`, or open `/demo` |
| Anjali | `DEMO8B`, roll `1`, PIN `1111` |
| Ravi | `DEMO8B`, roll `2`, PIN `2222` |
| Roll 3 to 46 | `DEMO8B`, roll `n`, PIN `3000 + n` |

## 9. Ten minutes before you present

- Open the live site, run `/demo` once (it caches the classroom offline).
- Keep two tabs: teacher (`/demo`) and student (`/s/login`), phone width.
- Have [DEMO_SCRIPT.md](DEMO_SCRIPT.md) open on a second screen.
- If the network fails, keep going: everything you need is already on the device.
