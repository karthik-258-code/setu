# Demo script: six minutes, Prove round

Everything below runs in demo mode (`LocalDemoApiClient`): no backend, no network after the first load. The classroom is Class 8 B from the submission (section 2.4): Anjali, Ravi and 44 simulated students who took the Readiness Check on Monday. See [DECISIONS](DECISIONS.md) (6.1) for how the classroom is generated.

## Before you start (once)

```
pnpm install
pnpm build      # builds the content packs and apps/web/public/demo/seed.json
pnpm dev
```

Use a phone-sized window (360 px wide) for student screens. Keep two browser tabs: one for the teacher, one for the shared student phone.

| Who | Sign in |
| --- | --- |
| Teacher | `teacher@demo.setu.app` / `setu-demo` (or just open `/demo`) |
| Anjali | classroom `DEMO8B`, roll `1`, PIN `1111` |
| Ravi | classroom `DEMO8B`, roll `2`, PIN `2222` |
| Roll 3 to 46 | classroom `DEMO8B`, roll `n`, PIN `3000 + n` (roll 3 is `3003`) |

## 0:00 to 0:30: the problem in one sentence

"One Class 8 teacher, 46 students, one chapter. Some students are ready; some are stuck two classes back. Setu finds out which, in ten minutes, and tells the teacher what to do in the next period."

## 0:30 to 1:45: the Gap Map (teacher tab)

1. Open `/demo`. It loads the seeded classroom, signs the teacher in and lands on the **Gap Map** for Linear Equations in One Variable.
2. Point out the layout: prerequisite concepts (Classes 6 and 7) on the left, chapter concepts on the right, one row per student, grey where a student has no evidence, a red ring on each student's **root gap**.
3. Scroll: the student column stays put; 46 rows on one screen.
4. Tap **Ravi's** cell on *adding unlike fractions*. The evidence drawer shows the question, the answer he chose and the misconception label (*adds denominators*). "This is why the map says what it says."

## 1:45 to 2:45: Groups and one action (teacher tab)

1. **Back**, then **Groups**. The engine proposes the groups from the submission: ready for the chapter (with Anjali), adding unlike fractions (with Ravi, mostly *adds denominators*), integer sign errors, and not attempted.
2. On the fractions group, show the three warm-up questions inline. Tap **Accept**.
3. Use a chip's **Move** menu to put one student into the sign-errors group: the teacher's knowledge overrides the suggestion.
4. Tap **Mark taught** on the fractions group. The confirmation states the consequence: "Re-check scheduled for N students."

Every edit is an event (`group_edit`, `mark_taught`); nothing is decided for the teacher.

## 2:45 to 4:15: Anjali and Ravi, same chapter, different next steps (student tab)

1. Open `/s/login` and sign in as **Anjali**. Her home card says **Practise**, starting on the chapter at level 2: her Readiness Check gave her an advanced entry. Open it: one question at a time, the three dots of the difficulty ladder, immediate feedback with the solution.
2. **Switch student** and sign in as **Ravi** on the same phone. His card is different: because of *adds denominators*, the policy first offers a **Quick check** on adding unlike fractions (the re-check the teacher just scheduled), and otherwise the **Learn** card with the worked example built for that misconception.
3. In Learn, tap **Read in Telugu** and back. Tap **I understood, let me try**: Solve starts at level 1, with a hint button (hints are counted on the attempt).
4. Point at the reason line on each home card: the engine's rule, rendered in the student's language.

## 4:15 to 5:00: re-check and teacher override

1. As Ravi, take the three-question check: no hints, then a result screen with the mastery outcome and what happens next ("Next quick check on ..." or "We will practise a little more first").
2. Back on the teacher tab: Gap Map, tap **Ravi**'s name. On his page choose a concept, **Mastered (seen in class)**, add a note, **Save override**. The confirmation says he will get a short check to confirm it; on his phone the home card now shows **Confirm** first.

## 5:00 to 6:00: offline and scaling

**Class 9 scaling moment (teacher tab).** Back to the classrooms list, **Launch a chapter**, pick Class 9 *Linear Equations in Two Variables*. The prerequisite list now shows Class 8 and Class 7 concepts; tick one off to show the teacher can trim it, and tap **Print paper check** for the 12-question sheet. Tap **Launch**: on the student tab, the next sign-in starts that chapter's Readiness Check, which descends into Classes 8 and 7 when a prerequisite fails. Relaunch the Class 8 chapter afterwards to restore the demo.

**Offline toggle (student tab).** Use a production build (`pnpm build`, then `pnpm --filter @setu/web preview`) so the service worker is active; the home card shows **Downloaded for offline**. In DevTools, Network, choose **Offline**. A notice says the work is saved on the phone. Reload the page, sign in from the profile picker, and run Learn, Solve and a test: everything works, and the events wait on the device for sync.

Close with: "The same engine runs on the phone, in the API and in the simulation. The teacher keeps every decision."

## Honest notes for questions

- Telugu content is a first draft and needs review by a Telugu-medium maths teacher.
- The 44 extra students are simulated through the real Readiness Check with planted gaps; they are not real data.
- Group edits are recorded for audit; the engine recomputes its suggestions from evidence on reload.
