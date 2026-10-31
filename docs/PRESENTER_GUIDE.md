# Presenter guide

A practical guide for presenting Setu's current demo. Use [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the timed walkthrough.

## 1. Choose the right demo

The deployed site has two modes. They use separate data:

| Open | What it shows | Best for |
|---|---|---|
| [`/demo`](https://setu-3vfo.onrender.com/demo) | A local browser demo with 46 students and generated learning history. No sign-in or database needed. | The full teacher story: Gap Map, evidence, groups, and student pathways. |
| [`/s/login`](https://setu-3vfo.onrender.com/s/login) | The API-backed app using the Render Postgres database. | Showing student sign-in, actual sync, or the deployed stack. |

The API database starts with 46 students in Class 8B and 40 in Class 9A. Class 8B has its chapter launched; Class 9A does not. The database seed does **not** fill every student's learning history. Most progress appears only after students use the app. For a populated classroom story, use `/demo`.

### Demo sign-ins

| User | Classroom | Roll | PIN / password |
|---|---|---:|---|
| Teacher | — | — | `teacher@demo.setu.app` / `setu-demo` |
| Anjali | `DEMO8B` | 1 | `1111` |
| Ravi | `DEMO8B` | 2 | `2222` |
| Class 8B students, rolls 3–46 | `DEMO8B` | their roll | `3000 + roll` (roll 3: `3003`) |

In `/demo`, open the route directly to enter as the demo teacher. The sign-ins above are for the login screens.

## 2. Before presenting

- Open [`/demo`](https://setu-3vfo.onrender.com/demo) and check that the Gap Map loads with 46 rows.
- Open [`/s/login`](https://setu-3vfo.onrender.com/s/login) once if you plan to show the API-backed student app. Free Render services may be asleep; the first request can take a while to wake.
- Keep the teacher demo in one tab and the student flow in another. Use a 360 px-wide viewport for the student tab.
- Rehearse the walkthrough once. Avoid using the live database as the source of simulated learning history.
- For an offline moment, load `/demo` first, then use DevTools **Network → Offline** and reload. Rehearse this before the presentation.

If the demo seed fails to load, check that [`/demo/seed.json`](https://setu-3vfo.onrender.com/demo/seed.json) returns JSON. The seed is built by `pnpm content:pack` and published with the static app.

## 3. Six-minute walkthrough

1. **Set the problem (30 sec).** One teacher, 46 learners, one chapter. Some students are blocked by earlier concepts; the teacher needs to know where before teaching.
2. **Read the Gap Map (75 sec).** Open `/demo`. Prerequisites sit beside chapter concepts; each row is a student. Point out the root-gap marker and the difference between evidence and no attempt.
3. **Show evidence (30 sec).** Open Ravi's fraction cell. Explain the answer and misconception shown in the drawer: the map is backed by the student's response.
4. **Show groups and teacher control (60 sec).** Open **Groups**. Review a suggested group and its warm-up questions. Show that the teacher can accept or move students, then mark the lesson taught.
5. **Compare students (90 sec).** Sign in as Anjali, then switch to Ravi. They have different next steps because their evidence differs. Show one resource or guided question and the reason for the recommendation.
6. **Close the loop (45 sec).** Show the re-check or weekly view. Explain that the teacher reviews the result and chooses the next classroom action.
7. **Show offline (60 sec).** Use the rehearsed offline step. Explain that student work is queued on the device and syncs when the connection returns.

Optional if time remains: show **Launch a chapter** and the printable paper check. Class 9A has no launched chapter in the database yet; use the local demo if you need a reliable launch walkthrough.

## 4. One-minute explanation

> Setu helps a teacher find the earlier concept blocking a student before a new chapter starts. Students answer a short readiness check. Setu uses the answers to suggest a learning path, while the teacher sees the evidence, reviews groups, and decides what to do. The student app can keep working offline and sync later.

## 5. Features to point out

| Students | Teachers | Platform |
|---|---|---|
| Readiness Check, up to 12 questions | Gap Map with evidence | Offline-first PWA |
| Learn in English or Telugu | Suggested groups and warm-ups | Shared TypeScript learning engine |
| Guided Solve with hints | Launch, paper check and paper entry | Fastify API and PostgreSQL |
| Tests, mastery and re-checks | Assign, override and mark taught | Event log and sync queue |

The same learning engine is used by the web app, API and simulation. Teacher suggestions support classroom decisions; the teacher remains in control.

## 6. Honest answers

- **Are the 46 students real?** No. In `/demo`, Anjali and Ravi follow the demo story and the other 44 learners are simulated. The API database contains a demo roster; it is not pilot data.
- **How accurate is it?** In a 1,000-learner simulation, single-gap recall is **86.2%**, precision is **66.4%**, and the Gap Map's root cause matches a planted gap for **47.4%**. With double gaps, recall is **79.2%**, precision is **80.5%**, and root-cause accuracy is **60.0%**. These are simulated results, not classroom measurements. See [EVALUATION.md](EVALUATION.md).
- **Is the 85% target met?** Yes, for single planted gaps in this simulation: 86.2%. It is not met for double gaps.
- **Has Telugu been reviewed by a teacher?** Not yet. Telugu content is a draft and needs review by a Telugu-medium mathematics teacher before classroom use.
- **Does it use AI while students work?** No. There are no runtime LLM or translation calls. The product is designed to work offline and explain its recommendations.
- **What about privacy?** The design limits student data to first name, roll number, classroom, language and a hashed PIN. The live demo is not a production school pilot; see [DEPLOYMENT.md](DEPLOYMENT.md) for current limits.
- **What remains?** Phase 7 items are optional stretch work: Python/pyBKT analysis, translation drafting, a Capacitor wrapper and a virtualized Gap Map. A real classroom pilot and Telugu review are needed before making classroom-effectiveness claims.

## 7. Useful links

- [Live demo](https://setu-3vfo.onrender.com/demo)
- [Student sign-in](https://setu-3vfo.onrender.com/s/login)
- [Six-minute demo script](DEMO_SCRIPT.md)
- [Evaluation](EVALUATION.md)
- [Deployment and privacy limits](DEPLOYMENT.md)
- [Teacher screenshots](wireframes/screenshots/)
