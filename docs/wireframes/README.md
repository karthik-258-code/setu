# Teacher wireframes

Low-fidelity wireframes for the teacher screens, as plain HTML files: open any of them in a browser, no build step. They show layout and content, not final styling. Screenshots of the built screens in demo mode live in [`screenshots/`](screenshots/).

| Screen | Wireframe | Built screen (demo mode) | Screenshot |
|---|---|---|---|
| Launch a chapter | [launch.html](launch.html) | `/t/classrooms/demo-8b/launch` | [launch.png](screenshots/launch.png) |
| Gap Map | [gapmap.html](gapmap.html) | `/t/classrooms/demo-8b/gapmap` | [gapmap.png](screenshots/gapmap.png) |
| Evidence drawer | [evidence.html](evidence.html) | tap any Gap Map cell | [evidence.png](screenshots/evidence.png) |
| Groups | [groups.html](groups.html) | `/t/classrooms/demo-8b/groups` | [groups.png](screenshots/groups.png) |
| Mark taught confirmation | [mark-taught.html](mark-taught.html) | Groups, **Mark taught** | [mark-taught.png](screenshots/mark-taught.png) |
| Weekly view | [weekly.html](weekly.html) | `/t/classrooms/demo-8b/weekly` | [weekly.png](screenshots/weekly.png) |

## Five minutes before class

The routine the screens are built for, on a phone in the staff room.

1. **Open the Gap Map (30 seconds).** Prerequisites are on the left, this chapter on the right. Red and amber columns on the left mean students are blocked before the chapter even starts. The red ring marks each student's root gap.
2. **Check one cell (30 seconds).** Tap a red cell for the largest gap. The evidence drawer shows the question, the answer the student chose and the misconception, for example *adds denominators* on 1/2 + 1/3. Now you know what to say, not just who is behind.
3. **Open Groups (1 minute).** The largest gap group is first, with its three most-missed questions. Accept it, move a student you know belongs elsewhere, or dismiss a group you will not run today.
4. **Plan the warm-up (2 minutes).** Use the three questions on the board for ten minutes; the common wrong answers tell you which mistake to name out loud.
5. **After the lesson (30 seconds).** Tap **Mark taught** on the group. The confirmation says how many students get a re-check; by their next session Setu asks them three quick questions, and the weekly view shows whether the lesson worked.

Students without a phone take the printed paper check from **Launch a chapter**; their answers go in through **Paper entry** and appear on the same Gap Map.
