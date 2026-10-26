# Setu: Adaptive Learning that Finds the Gap Before the Chapter Begins

**Code Kernel '26, Decode Round submission**
**Track:** Adaptive Learning for Classes 6 to 10 (X-Kernel, GRIET, Hyderabad, in collaboration with Canvas Classes)
**Prepared by:** Karthik Chiluveru
**Working name:** Setu (Sanskrit and Hindi for "bridge")

> **In one paragraph.** Setu is a teacher-centred, offline-first adaptive learning system for Classes 6 to 10. Before a teacher starts a chapter, every student takes a ten-minute *Chapter Readiness Check* that walks backwards through a prerequisite concept graph and pinpoints exactly which earlier concept (often from Class 6 or 7) is blocking each student. From that evidence, Setu builds an individual Learn, Solve and Test pathway with its own entry point, difficulty and pace, and gives the teacher a class *Gap Map* that groups students by the specific prerequisite they are missing, with the wrong answers that prove it. The teacher decides what to do with that information; Setu does the diagnosis, the practice and the follow-up checks. The first version targets Class 8 Mathematics (Linear Equations in One Variable and its Class 6 and 7 prerequisites) in English and Telugu, runs on a shared Android phone without continuous internet, and uses transparent, explainable algorithms (a prerequisite graph, Bayesian Knowledge Tracing and a rule-based pathway policy) that a hackathon team can build and demonstrate.

---

## 1. The problem and who we are solving it for

### 1.1 What the problem statement says

The official problem statement describes a classroom where everyone receives the same lesson, the same questions and the same pace. Fast learners wait; students who missed an earlier idea try to build on a gap; the teacher has no clear view of who has understood what; and tests arrive at the end of a chapter, after the class has already moved on. Students in Classes 6 to 10 face concepts that build on each other, rising board-exam pressure, instruction in a language that may differ from the home language, uneven device and internet access, and extra tuition hours that do not always add understanding. The statement asks for a solution that adapts across **Learn, Solve and Test**, is built for Indian boards, class sizes, languages and connectivity, and **empowers the school teacher** rather than replacing them.

### 1.2 The specific failure we chose to attack

Within that broad problem, we focus on one failure that the statement itself highlights: **the gap grows quietly and is discovered too late.** A Class 8 student who cannot add fractions will fail linear equations with fractional coefficients, but nobody finds this out until the end-of-chapter test, and by then the chapter is over. The teacher does not have the time, in a class of 40 to 60, to interview every student about Class 6 fractions before teaching Class 8 algebra.

So the question we answer is narrower and sharper than "build an adaptive learning app": **How can a teacher know, before teaching a chapter, exactly which earlier concept each student is missing, and then let each student bridge that gap at their own pace while the class moves on?**

### 1.3 Target users

| User | Who they are | How often they use Setu |
|---|---|---|
| **Mathematics teacher, Classes 6 to 10** (primary user and decision maker) | Teaches 2 to 5 sections of 40 to 60 students each, in a government or budget private school; limited planning time; often uses a personal Android phone | 5 minutes before a class (Gap Map), 10 minutes at the start of each chapter (launch the Readiness Check), 15 minutes a week to review groups and assign work |
| **Students, Classes 6 to 10** (ages 11 to 16) | Mixed readiness; many Telugu-medium or English-medium with Telugu at home; may share a family phone; patchy data | 15 to 20 minute sessions, 3 to 4 times a week, in a school lab, on a shared phone at home, or on paper when no device is available |
| **School head or coordinator** (secondary) | Needs section-level progress, not individual control | Monthly summary |

Parents are deliberately not a first-version user. The teacher is the person who can act on the information, and the problem statement asks us to put teachers back at the centre.

### 1.4 The unmet need

Existing apps and coaching tools work around the teacher: they practise with the student at home and report a score. The teacher receives, at best, a percentage. What the teacher actually needs is **concept-level, prerequisite-aware, evidence-backed information that arrives before the chapter is taught and is organised into groups they can act on in a 40-minute period.** That is what Setu provides.

---

## 2. The idea: Setu and how it adapts to each student

### 2.1 Central mechanism

Setu is built around three connected parts:

1. **A prerequisite concept graph** for the syllabus. Each chapter is broken into small concepts (for example, *solving ax + b = c by transposition*), and each concept lists the earlier concepts it depends on (*operations with integers*, *adding unlike fractions*, *combining like terms*, *Class 7 simple equations*). Prerequisites reach back across classes, so a Class 8 chapter can point to Class 6 content.

2. **A per-student mastery estimate for every concept**, updated after each answer with Bayesian Knowledge Tracing (BKT), and seeded from the graph: if a student has not mastered a prerequisite, Setu's initial belief about the dependent concept is lowered.

3. **A transparent pathway policy** that picks, for each student, the next concept on the *frontier* of the graph (all prerequisites mastered, concept itself not yet mastered), the mode (Learn, Solve or Test), the difficulty level and the pace, and records a plain-language reason for every recommendation.

These three parts are used in two places: by the **student app** to drive individual pathways, and by the **teacher Gap Map** to show the class as groups of students who share the same missing prerequisite.

### 2.2 How a student starts: the Chapter Readiness Check

When the teacher opens a chapter in Setu (for example, Class 8, *Linear Equations in One Variable*), each student takes a **Readiness Check** of at most 12 questions, about ten minutes:

- It starts with two medium-difficulty questions on each *direct* prerequisite of the chapter.
- If a student answers a prerequisite correctly, Setu does not go deeper on that branch (saving time).
- If a student gets a prerequisite wrong, Setu descends to *its* prerequisites, so a wrong answer on "equations with fractions" can lead to a question on "adding unlike fractions" and then to "equivalent fractions" from Class 6.
- Every wrong option in the bank is tagged with a **misconception code** (for example, *adds numerators and denominators*, *drops the sign when transposing*), so Setu records not just *that* a student was wrong but *why*.
- Students who clear all prerequisites quickly are given two questions from the chapter itself; if they get these right, they start the chapter at an advanced entry point.

The Readiness Check is the "Test" part of studying moved to the *beginning* of the chapter, which is precisely where the problem statement says it is missing.

### 2.3 How Learn, Solve and Test adapt for each student

After the Readiness Check, every student has a personal pathway through the graph. For each concept on that pathway, Setu runs a short loop:

| Stage | What the student sees | How it adapts |
|---|---|---|
| **Learn** | A short explanation (text plus a small diagram), one worked example, in the student's chosen language | Skipped entirely if the Readiness Check already shows mastery. The worked example is chosen to counter the student's recorded misconception (a student who adds denominators sees an example built around equivalent fractions). Struggling students receive the prerequisite micro-lesson first. |
| **Solve** | Practice questions on a three-level difficulty ladder, with hints | Up one level after two consecutive correct answers without hints; down one level, plus a worked example, after two consecutive wrong answers or any flagged misconception. Fast learners start at level 2 and get extension problems (word problems, multi-step equations) after mastery. |
| **Test** | A three-question check at the end of the concept, and short spaced re-checks after 2, 7 and 21 days | A concept is marked mastered when the BKT estimate reaches 0.9 or higher after the check. Re-checks catch forgetting; a failed re-check reopens the concept at Solve level 1. |

**Pace** is the outcome of these rules rather than a separate setting: a student who already knows the prerequisites moves through a chapter in a few sessions and spends the rest of the time on extension work, while a student with two missing prerequisites spends their first sessions on Class 7 content and reaches the chapter later, but with the foundation in place. The teacher can see both and can adjust either.

### 2.4 Worked example: two students, the same chapter, different next steps

*Setting:* Class 8, Section B, 46 students, Telugu-medium school in Hyderabad. Teacher: Ms. Lakshmi. Chapter: Linear Equations in One Variable. Students: Anjali and Ravi.

**Monday, period 3, Readiness Check (10 minutes, school lab, offline pack already downloaded).**

- **Anjali** answers the two integer questions, the two fraction questions, the two like-terms questions and the two simple-equation questions correctly, in six minutes. Setu gives her two chapter questions (variable on both sides). She gets both right. Her mastery estimates for all four prerequisites rise above 0.9; her estimate for the first two chapter concepts starts at 0.7.
- **Ravi** answers the integer questions correctly. On "1/2 + 1/3" he picks 2/5 (misconception code *F-ADD-DENOM*). Setu descends: he answers an equivalent-fractions question correctly, so the gap is specifically *adding unlike fractions*, not fractions in general. He gets one like-terms question right and one wrong (*combines unlike terms*). On simple equations he solves x + 5 = 12 but fails 3x = 2/5. Twelve questions used.

**Monday evening, what each student is offered (on a shared phone, offline).**

- **Anjali:** Learn stage for *equations with the variable on both sides* is marked optional; she is taken to Solve at difficulty level 2. After two correct, level 3. Her reason panel reads: "You already know the basics for this chapter. Starting with harder problems." By Wednesday she has mastered the first three chapter concepts and is offered extension word problems (ages, perimeter, consecutive numbers).
- **Ravi:** His frontier concept is *adding unlike fractions* (Class 6). Learn stage shows a Telugu explanation and a worked example built around finding a common denominator, chosen specifically because of code *F-ADD-DENOM*. Solve starts at level 1; two wrong answers in a row trigger a second worked example and a hint. By the end of the session his estimate is 0.82. His reason panel reads: "Before equations with fractions, we are practising adding fractions. You are nearly there." Tuesday he passes the three-question check (estimate 0.93), and his pathway moves to *combining like terms*, then to *simple equations with fractional coefficients*, and only then into the Class 8 chapter.

**Tuesday morning, Ms. Lakshmi's Gap Map (5 minutes before class, on her phone).**

- Group A, "Ready for the chapter": 14 students, including Anjali.
- Group B, "Adding unlike fractions, mostly *adds denominators*": 15 students, including Ravi. Suggested action: a 10-minute whole-class warm-up using the three most-missed fraction questions, with the common wrong answers shown so she can address them directly.
- Group C, "Sign errors with integers": 9 students. Suggested action: a small-group activity during practice time.
- Group D, "Not attempted or absent": 8 students. Suggested action: a printable paper version of the Readiness Check.

She accepts the warm-up for Group B, edits Group C to add two students she knows struggle, dismisses nothing, and taps **"Taught in class: adding unlike fractions"**. Setu schedules a three-question re-check for Group B on their next session, so Ms. Lakshmi will see by Thursday whether her ten minutes worked. She also pairs Anjali with Ravi for the warm-up, a decision that is hers, informed by Setu but not made by it.

**What this shows:** the same chapter produced different entry points, different explanations, different difficulty levels and different pace for Anjali and Ravi, because their evidence differed; and the teacher received a class picture she could act on inside one period, with the decisions left to her.

### 2.5 Why this is not an ordinary learning app

| Ordinary adaptive app or quiz generator | Setu |
|---|---|
| Diagnoses within the current chapter | Diagnoses **backwards across classes** through a prerequisite graph |
| Reports a score | Reports **which concept** and **which misconception**, with the student's actual wrong answers as evidence |
| Works around the teacher at home | Puts the teacher first: the **Gap Map and groups** are the primary output, the teacher approves, edits, overrides and triggers re-checks |
| Tests at the end | Tests at the **start** (Readiness Check), then continuously (concept checks and spaced re-checks) |
| Assumes a personal device and data | Offline-first PWA, shared-phone profiles, **paper fallback with teacher entry** |
| Opaque recommendation | Every recommendation stores and shows a **plain-language reason** |

---

## 3. The plan: approach, algorithms, teacher workflow, India-specific design, stack and evaluation

### 3.1 Algorithms and their responsibilities

We chose the smallest set of techniques that can do the job with a limited, curated content set and **no pre-existing dataset of Indian students**. Everything in the first prototype is explainable to a teacher.

| Component | Role in Setu | Inputs | Outputs | Why this choice | Limits and later options |
|---|---|---|---|---|---|
| **Prerequisite concept graph** (directed acyclic graph, authored by the team from NCERT and Telangana SCERT textbooks) | Backbone for diagnosis, pathway selection and teacher grouping | Concepts, prerequisite edges, chapter membership | Frontier concepts per student; traversal order for the Readiness Check | Encodes exactly the "concepts build up" problem; cheap; teachers can read and correct it | Hand-authored for one subject and class in v1; later versions can mine edges from attempt data |
| **Adaptive graph-traversal diagnostic** (rule-based) | Chapter Readiness Check | Graph, question bank, student answers | Cleared and failed prerequisites, misconception codes, within 12 items | Needs no training data; shorter than a fixed test because mastered branches are pruned | Depth limited to 3 levels in v1; later we can use item response theory to pick maximally informative items |
| **Bayesian Knowledge Tracing** (one two-state model per concept: p(L0), p(T), p(G), p(S)) | Mastery estimation from each answer | Correct or incorrect per attempt, prerequisite mastery for the prior | p(known) per concept, 0 to 1 | Standard, well studied, four interpretable parameters, trivial to run on a phone offline, works from the first answer | Default parameters in v1 (p(L0) 0.3 adjusted by prerequisites, p(T) 0.2, p(G) 0.2, p(S) 0.1); fitted per concept with pyBKT once pilot logs exist; Deep Knowledge Tracing is not justified at our data scale |
| **Misconception tagging** (distractor coding) | Distinguishes *why* an answer is wrong | Selected option, option tag | Misconception code per attempt; counts per class | Lets Learn pick a targeted worked example and gives the teacher a "top misconceptions" list; no NLP required | Only for multiple-choice and numeric-with-known-error-patterns items in v1; free-text diagnosis is a later option |
| **Pathway and difficulty policy** (deterministic rules, logged with reasons) | Chooses next concept, mode (Learn, Solve, Test), difficulty level, extension or remediation | Frontier set, mastery estimates, last two outcomes, hint use, misconception flags, teacher overrides | Next activity plus a reason string | Auditable; teachers can predict it; easy to test; reinforcement learning or bandits would need data we do not have | Thresholds (0.9 mastery, 2-up and 2-down ladder) tuned by simulation and pilot |
| **Spaced re-check scheduler** (Leitner-style intervals 2, 7, 21 days) | The ongoing "Test" part | Mastery date, re-check outcomes | Scheduled 3-question checks | Simple, evidence-based retrieval practice; detects forgetting before the exam | Fixed intervals in v1 |
| **Teacher grouping** | Builds Gap Map groups | Each student's lowest unmastered prerequisite and dominant misconception | 3 to 5 named groups with suggested actions | Deterministic grouping by shared gap is what a teacher can act on; clustering would be opaque | Teacher can split, merge and edit groups |

**Not in the first prototype, by design:** a conversational AI tutor (unreliable offline, hard to verify in Telugu, and not what the teacher needs), live machine translation shown to students, and deep learning models that require logs we do not yet have. Large language models are used only *offline in the content pipeline* to draft explanation variants and item wording that a teacher reviews before publication; nothing generated reaches a student unreviewed.

### 3.2 The teacher workflow

The teacher's tools are designed for five minutes on a phone before class:

1. **Launch a chapter.** Picks the chapter; Setu shows the prerequisite list and the Readiness Check it will run. The teacher can remove a prerequisite she knows the class has covered.
2. **Gap Map.** A heatmap of concepts (columns) by students (rows), coloured by mastery estimate, with the chapter's prerequisites on the left and chapter concepts on the right. One tap on a cell shows the evidence: the questions attempted, the chosen answers and the misconception codes.
3. **Today's groups.** Students grouped by their lowest unmastered prerequisite and dominant misconception, each with a suggested 10-minute activity drawn from the question bank. The teacher **accepts, edits, dismisses or re-groups**.
4. **Actions.** Assign a concept or set of questions to a group; **override** a student's mastery ("observed in class") with the override recorded and followed by a light verification check; **mark taught**, which schedules a re-check so the teacher learns whether the lesson worked; lock or unlock extension content; print a paper Readiness Check and enter results in a tap-per-question grid for students without devices.
5. **Weekly view.** Movement of students between groups, concepts still blocking the most students, and re-check results after teaching.

Setu never changes a student's pathway in a way the teacher cannot see, and every suggestion carries its evidence. The teacher remains the one who teaches, regroups, re-explains and decides.

### 3.3 India-specific design

**Curriculum.** First version: **Class 8 Mathematics, chapter *Linear Equations in One Variable*, with its prerequisite chain from Classes 6 and 7** (integers, fractions and decimals, algebraic expressions and like terms, simple equations). This chapter exists in both NCERT (CBSE) and Telangana SCERT Class 8 syllabi, so one graph serves both with board-specific tags on concepts and questions. Target content for the Build round: about 40 concepts and 300 questions (roughly 120 hand-authored items plus parametric templates that generate numeric variants per concept and difficulty level). Expansion is additive: new chapters add nodes and edges to the same graph, and a second subject (Science) uses the same engine with a new graph. We do not claim coverage of all boards or classes in the first version.

**Languages.** First version: **English and Telugu**, chosen because the event and the pilot schools are in Hyderabad. All student-facing text (explanations, questions, hints, reason strings) is authored bilingually by the team and verified by a Telugu-medium mathematics teacher against the terminology used in Telangana SCERT textbooks, using a shared glossary so that terms like *variable*, *coefficient* and *transpose* are consistent. Students switch language per screen and can view a question bilingually (useful for students moving from Telugu medium to English medium). Machine translation (for example, AI4Bharat IndicTrans2 or Bhashini) is used only to produce drafts for human review, and every content item carries a review status; unreviewed items are never shown. Hindi is the planned third language.

**Limited connectivity.** The student app is a Progressive Web App that installs from the browser on Android. A **chapter pack** (concept graph, bilingual explanations, questions and small SVG diagrams, about 3 to 5 MB) is downloaded once, in school, over Wi-Fi or shared hotspot. The mastery engine and pathway policy run **on the device**, so Learn, Solve and Test all work with no connection. Attempts are queued locally and synchronised in small batches when a connection appears; the server replays attempts through the same engine code, so offline and online estimates agree. **Real limitations:** new content and the teacher Gap Map need connectivity (the teacher's phone needs data or school Wi-Fi), students' progress is visible to the teacher only after their device syncs, and the first download must happen somewhere with a connection.

**Unequal devices.** Mobile-first layout tested on low-end Android browsers; under 1 MB of application code; no video; **shared-device mode** with multiple student profiles protected by a four-digit PIN on one phone; a **paper fallback** where the teacher prints the Readiness Check and enters answers in a grid, so students with no device still appear on the Gap Map.

**Class size and time.** The Readiness Check fits in ten minutes of a period or lab slot; the Gap Map is designed for 60 rows; groups are capped at five so the teacher can act on them.

**Student privacy.** Students are created by the school, identified by first name, roll number, class and section only; **no phone numbers, emails, addresses or photographs of students** are collected. Processing children's data is done under the school's authority with parental consent collected by the school; the design anticipates India's Digital Personal Data Protection Act, 2023, which requires verifiable parental consent for children's data and prohibits tracking and targeted advertising aimed at children (Setu has no advertising or third-party analytics). Details are in Section 3.6.

### 3.4 Technology stack

| Layer | First version | Why | Reserved for later |
|---|---|---|---|
| **Frontend** | React + TypeScript + Vite, built as a PWA with Workbox (service worker) and Dexie (IndexedDB) for offline storage; Tailwind CSS | Mature, installable on Android browsers, small bundle, offline-capable without an app store | Capacitor wrapper for Play Store distribution |
| **Shared engine package** (`@setu/engine`, TypeScript) | Concept graph utilities, BKT update, pathway and difficulty policy, Readiness Check traversal, re-check scheduler | **One implementation runs in the browser (offline) and on the server**, so estimates are identical; small enough to unit-test exhaustively | Parameter tables updated from fitted values |
| **Backend** | Node.js + Fastify (TypeScript), Prisma ORM, JWT authentication with role-based access, REST endpoints for sync, teacher views and content packs | Same language as the engine and frontend; a student team can move quickly; a single service is enough | Background worker for weekly summaries |
| **Database** | PostgreSQL (managed or on a single VM); content authored as versioned JSON and YAML in the repository and loaded into the database | Relational data (students, attempts, mastery) fits naturally; strong constraints and auditing | Read replicas only if scale demands |
| **AI and ML tooling** | BKT and policy in the engine package; Python (numpy, pandas, networkx, pyBKT) for offline simulation, parameter fitting and evaluation notebooks | Keeps the production path simple and the analysis path flexible | Item response theory calibration, LLM-assisted content drafting with teacher review, IndicTrans2 for translation drafts |
| **Supporting** | Docker Compose, GitLab CI for tests and builds, object storage for content packs, hosting in an Indian region | Cheap, reproducible, one-command local setup | CDN for packs |

### 3.5 Data model

```
School 1--* Classroom 1--* Student            Teacher *--* Classroom (TeacherAssignment, role)
Board/Syllabus 1--* Subject 1--* Chapter 1--* Concept
Concept *--* Concept  (ConceptPrerequisite: prerequisite_id -> dependent_id)
Concept 1--* Resource (type: explanation | worked_example | hint, language, targets_misconception, review_status)
Concept 1--* Question (difficulty 1..3, type, template_params, language variants, board_tags, review_status)
Question 1--* Option (is_correct, misconception_code)
Student 1--* Attempt (question_id, option_id or value, correct, hints_used, time_ms, mode: readiness|solve|test|recheck, device_ts, synced_at)
Student 1--* MasteryState (concept_id, p_known, attempts, last_correct_at, mastered_at, source: model|teacher_override)
Student 1--* Recommendation (mode, concept_id, resource_id or question_id, difficulty, reason_text, rule_id, created_at, acted_on)
Teacher 1--* TeacherAction (type: override|assign|mark_taught|lock|unlock|group_edit, target, note, created_at)
Student 1--* RecheckSchedule (concept_id, due_at, interval_days)
Device 1--* SyncLog (batch_id, attempts_count, received_at)
```

**How the stored data drives adaptation.** The Readiness Check traverses `ConceptPrerequisite` edges from the chapter's concepts and writes `Attempt` rows with `misconception_code` taken from the chosen `Option`. Each `Attempt` updates `MasteryState` through BKT. The policy reads `MasteryState` across the graph to compute the frontier, reads the last attempts for the ladder rule, selects a `Resource` whose `targets_misconception` matches the student's recent code, and writes a `Recommendation` with `reason_text`. The Gap Map is a query over `MasteryState` joined to `Concept` for a `Classroom`; groups are derived from each student's lowest unmastered prerequisite plus the most frequent recent `misconception_code`. `TeacherAction` rows feed back: an override writes a `MasteryState` row with `source = teacher_override`, and `mark_taught` inserts `RecheckSchedule` rows. Permissions follow `TeacherAssignment`: a teacher reads and acts only on her own classrooms; a student reads only their own rows; coordinators see classroom aggregates without individual attempts.

### 3.6 Evaluation and privacy plan

**Evaluating recommendation quality before we have real students (offline, Build round).**

- *Gap-detection accuracy by simulation:* generate synthetic students with planted gaps at random nodes of the graph and answer behaviour drawn from BKT parameters; measure recall and precision of the Readiness Check in identifying the planted gaps, and the median number of items used, against a fixed 12-item test. Target: at least 0.85 recall for single planted gaps within 12 items.
- *Difficulty and pace policy by simulation:* simulate learners with different learning rates and measure items-to-mastery and the share of attempts in the 60 to 80 percent accuracy band, comparing the ladder against fixed difficulty.
- *Engine correctness:* unit tests with hand-computed BKT updates, golden test vectors shared between the browser and server builds, and replay tests that re-run stored attempts and must reproduce stored mastery values.
- *Content validity:* every question and explanation reviewed by two mathematics teachers for concept tag, difficulty level, misconception coding and Telugu wording; we record inter-rater agreement and fix items below agreement.

**Evaluating with students and teachers (small supervised pilot, Prove round and after).**

- One chapter, two sections, two to three weeks, with the school's and parents' consent. Pre-test and post-test on the chapter written by the teacher, not generated by Setu, with the second section taught as usual as a comparison where the school permits.
- *Calibration:* compare predicted probability of a correct answer with observed outcomes (calibration plot and Brier score) once logs exist, and refit BKT parameters per concept.
- *Teacher usefulness:* time to identify students needing help with and without the Gap Map; share of suggested groups accepted, edited or dismissed; a short usability survey; and whether re-check results after "mark taught" matched the teacher's own impression.
- *Student usability and engagement:* completion rate of sessions, time per session, hint use, and short interviews in Telugu and English; language quality judged by the pilot teachers.

**Privacy and security.**

- *Data minimisation:* first name, roll number, class and section for students; no contact details, location, photographs or third-party identifiers; analytics use pseudonymous IDs.
- *Consent and authority:* the school is the data fiduciary's point of contact; parental consent is collected by the school on paper or through the school's existing channels; students below 18 are never asked to agree to terms themselves; no advertising, no behavioural tracking, no sale or sharing of data.
- *Security:* TLS for all traffic; encryption at rest for the database and backups; teacher passwords hashed with Argon2; short-lived JWT access tokens with refresh tokens; student PINs for shared devices; the offline store holds only the signed-in students' own data and is encrypted where the browser supports it.
- *Access control and audit:* role-based access (student, teacher, coordinator, content author); teachers see only their assigned classrooms; every override and assignment is logged with who and when.
- *Retention and rights:* attempt-level data retained for the academic year plus one year for continuity, then aggregated or deleted; export and deletion on request from the school; hosting in an Indian region.

### 3.7 What the Build round will deliver

A working prototype demonstrating the complete loop for Class 8 Mathematics in English and Telugu: content pack with about 40 concepts and 300 questions; the student PWA with Readiness Check, Learn, Solve and Test working offline and syncing later; the teacher Gap Map with groups, evidence drawer, overrides, mark-taught re-checks and paper entry; the shared engine with unit and replay tests; and the simulation notebook with the gap-detection and difficulty results above. The demo seeds two students (as in Section 2.4) and shows how the same chapter produces different pathways and how the teacher acts on the Gap Map.

---

## 4. Mandatory application questions and answers

### Question 1

**What is your proposed solution, and how does it solve the adaptive learning problem?**

Setu is a teacher-centred, offline-first adaptive learning system for Classes 6 to 10 that finds each student's learning gap *before* a chapter is taught and then adapts Learn, Solve and Test to close it. The central innovation is a **Chapter Readiness Check**: a ten-minute adaptive diagnostic that walks backwards through a prerequisite concept graph (reaching into Class 6 and 7 content) and identifies the specific earlier concept and the specific misconception blocking each student. From that evidence, Setu builds an individual pathway with its own entry point, explanation, difficulty level and pace, and gives the teacher a class **Gap Map** that groups students by the prerequisite they are missing, with the wrong answers that prove it.

Target users are mathematics teachers in Classes 6 to 10 (the primary user and decision maker) and their students aged 11 to 16, in government and budget private schools with large classes, mixed languages and shared devices. The problem it solves is the one the statement calls "the gap grows quietly": gaps are discovered at the end-of-chapter test, after the class has moved on, and the teacher has no concept-level view of who is stuck where.

The main workflow: the teacher launches a chapter; every student takes the Readiness Check (on a shared phone, in the lab, or on paper with teacher entry); each student then follows a personal Learn, Solve, Test loop per concept, driven by Bayesian Knowledge Tracing mastery estimates and a transparent rule policy, working fully offline and syncing later; the teacher sees the Gap Map, accepts or edits suggested groups and ten-minute activities, overrides where she knows better, and marks what she taught so Setu schedules a re-check that tells her whether it worked.

It differs from an ordinary learning app in four ways: it diagnoses backwards across classes rather than within the chapter; it reports concepts and misconceptions with evidence rather than scores; the teacher's Gap Map and groups are the primary output and the teacher retains every instructional decision; and it is designed for Indian constraints from the start, with English and Telugu content verified against state textbooks, a 3 to 5 MB offline chapter pack, shared-device profiles and a paper fallback. The first version covers Class 8 Mathematics, Linear Equations in One Variable and its prerequisite chain, aligned to NCERT and Telangana SCERT.

### Question 2

**How will your system identify each student's strengths, weaknesses, and learning gaps, and adapt the content, difficulty, and pace for them?**

**Diagnosis.** Every chapter begins with a Chapter Readiness Check of at most 12 questions. It starts with two medium-difficulty questions on each direct prerequisite of the chapter. A correct branch is pruned; a wrong answer makes Setu descend to that prerequisite's own prerequisites, so a failure on "equations with fractional coefficients" can lead to "adding unlike fractions" and then to "equivalent fractions" from Class 6. Each wrong option carries a misconception code (for example, *adds numerators and denominators*), so Setu records why the student was wrong. Students who clear all prerequisites quickly receive two chapter-level questions and may start the chapter at an advanced entry point.

**Concept-level mastery tracking.** Each concept has a Bayesian Knowledge Tracing model that updates a probability of mastery after every answer, using four interpretable parameters (initial knowledge, learning rate, guess and slip). The initial belief for a concept is lowered when its prerequisites are not mastered, so the graph and the model work together. Strengths are concepts at or above 0.9; weaknesses are concepts below it; a learning gap is a weak concept that blocks a chapter concept.

**Decision policy.** Setu always works on the student's *frontier*: concepts whose prerequisites are mastered but which are not themselves mastered. For each frontier concept it runs Learn, Solve and Test. Learn is skipped if mastery is already shown and otherwise selects a worked example that targets the student's recorded misconception. Solve uses a three-level difficulty ladder: up after two consecutive correct answers without hints; down, with a new worked example, after two consecutive wrong answers or a flagged misconception. Test is a three-question check; mastery is confirmed at 0.9 or higher, and spaced re-checks after 2, 7 and 21 days catch forgetting and reopen the concept if needed. Every recommendation stores a plain-language reason.

**When a student struggles,** the pathway moves backwards to the missing prerequisite, explanations get shorter and more concrete, difficulty drops, hints and worked examples appear, and the student is flagged in the teacher's group for that prerequisite. **When a student demonstrates mastery,** Learn is skipped, Solve starts at level 2 and rises quickly, and after the concept check the student receives extension problems (multi-step and word problems) while the class continues. Pace is therefore the result of the evidence: the same chapter takes a prepared student a few sessions and a student with two missing prerequisites longer, but with the foundation rebuilt. Teacher overrides and "mark taught" actions feed back into the estimates and schedule verification checks, so the teacher's classroom observations also shape what comes next.

### Question 3

**Which algorithms or models are you planning to use (for example for recommendations, difficulty adjustment, or gap detection)? Explain what each one does in your solution and why you chose it.**

We use the smallest combination of transparent techniques that solves the problem with a curated content set and no pre-existing dataset of Indian students.

1. **Prerequisite concept graph (directed acyclic graph).** Hand-authored from NCERT and Telangana SCERT textbooks for Class 8 Mathematics and its Class 6 and 7 prerequisites (about 40 concepts in the first version). It is the backbone for gap detection (which earlier concept blocks this one), for the frontier computation that drives recommendations, and for teacher grouping. Chosen because it encodes exactly the "concepts build up" structure of the problem, is cheap, and can be read and corrected by teachers.

2. **Adaptive graph-traversal diagnostic (rule-based).** The Chapter Readiness Check prunes mastered branches and descends into failed ones, capped at 12 items and three levels deep. Chosen because it needs no training data and is shorter than a fixed test while reaching further back.

3. **Bayesian Knowledge Tracing (BKT)**, one model per concept, for mastery estimation. Inputs are correct or incorrect outcomes; output is a probability of mastery used by the policy and the Gap Map. The prior is adjusted by prerequisite mastery. Chosen because it is well studied, has four interpretable parameters, runs in a few lines on a phone offline, and gives a usable estimate from the first answer. We start with default parameters (initial 0.3, learn 0.2, guess 0.2, slip 0.1) and will fit them per concept with pyBKT from pilot logs. Deep Knowledge Tracing and similar neural models are not justified at our data scale and would not be explainable to teachers.

4. **Misconception tagging through distractor coding.** Each wrong option carries a code. It lets Learn choose a worked example that targets the error and gives teachers a "top misconceptions" list. Chosen because it adds diagnostic depth with no NLP and no model.

5. **Rule-based pathway and difficulty policy.** Selects the next frontier concept, the mode (Learn, Solve, Test), the difficulty level on a three-level ladder (up after two consecutive correct without hints, down after two consecutive wrong or a flagged misconception), and extension or remediation, and logs a reason for every choice. Chosen because it is auditable and predictable for teachers and easy to test; bandit or reinforcement learning policies would need data we do not have and would be harder to justify to a school.

6. **Spaced re-check scheduler** (Leitner-style intervals of 2, 7 and 21 days) for the ongoing Test part. Chosen because retrieval practice at increasing intervals is simple and well supported.

7. **Deterministic teacher grouping** by lowest unmastered prerequisite and dominant misconception, producing three to five groups with suggested activities. Chosen over clustering because teachers can see exactly why a student is in a group.

**Feasibility and data.** All of the above run inside one TypeScript engine package shared by the offline student app and the server, with Python used for simulation and parameter fitting. We validate with synthetic students before real ones. **Reserved for later:** item response theory for calibrating question difficulty, fitted BKT parameters, data-mined prerequisite edges, and large language models used only offline to draft explanations and translations for teacher review. No generated text reaches a student unreviewed, and no conversational tutor is planned for the first version.

### Question 4

**How will your solution help teachers monitor and guide students without replacing them?**

Setu treats the teacher as the primary user and the decision maker; the system diagnoses, practises and re-checks, and the teacher teaches.

**What the teacher sees.** A **Gap Map** for each section: a heatmap of concepts by students, with the chapter's prerequisites on the left and chapter concepts on the right, coloured by mastery estimate. One tap on any cell opens the evidence: the questions the student attempted, the answers chosen and the misconception codes. A **Today's groups** panel organises the class into three to five groups by the lowest unmastered prerequisite and the dominant misconception (for example, "15 students: adding unlike fractions, mostly adds denominators"), each with a suggested ten-minute activity built from the most-missed questions. A **weekly view** shows who moved between groups, which concepts still block the most students, and whether re-checks after teaching improved.

**Identifying students who need help.** The Readiness Check runs before the chapter, so the teacher knows on day one who is not ready and why, instead of finding out at the chapter test. Students who have not attempted (absent or no device) appear as their own group with a printable paper check.

**Evidence behind every suggestion.** Each group and each recommendation shows the attempts and wrong answers it is based on, and every automatic decision stores a plain-language reason. Nothing is presented as an unexplained score.

**Teacher control.** The teacher can accept, edit, split, merge or dismiss groups; assign a concept or question set to a group or student; **override** a mastery estimate based on classroom observation (the override is recorded and followed by a light verification check rather than silently trusted or ignored); remove a prerequisite from a Readiness Check she knows the class has covered; lock or unlock extension content; and tap **"Taught in class"** so Setu schedules a short re-check and reports whether the lesson worked. Students' pathways never change in a way the teacher cannot see.

**Practical for a busy classroom.** The Gap Map is designed for five minutes on a phone before a period, groups are capped so they can be acted on in one lesson, and the Readiness Check fits in ten minutes of a lab slot. Targeted teaching becomes possible because the teacher knows which fifteen students need a fractions warm-up and which nine need help with signs, and can pair ready students with struggling ones if she chooses. These remain her decisions; Setu's role is to make them informed and to tell her afterwards whether they worked.

### Question 5

**How will it work for Indian students with different languages, syllabus, and limited internet access?**

**Curriculum scope.** The first version covers Class 8 Mathematics, *Linear Equations in One Variable*, together with its prerequisite chain from Classes 6 and 7 (integers, fractions and decimals, algebraic expressions and like terms, simple equations). This chapter appears in both the NCERT (CBSE) and Telangana SCERT syllabi, so a single prerequisite graph serves both, with board tags on concepts and questions where wording or sequencing differs. Content is organised as chapters made of small concepts with explicit prerequisite links, bilingual resources per concept, and questions tagged by concept, difficulty and misconception. Target content for the Build round is about 40 concepts and 300 questions. Expansion is additive: new chapters add nodes to the same graph, other boards add tags, and a second subject reuses the engine with a new graph. We do not claim full coverage of every board or class in the first version.

**Languages.** The first version supports **English and Telugu**, chosen because the event and pilot schools are in Hyderabad. Every student-facing string (explanations, questions, hints, reasons) is authored bilingually and checked by a Telugu-medium mathematics teacher against the terminology used in Telangana SCERT textbooks, with a shared glossary so terms such as *variable*, *coefficient* and *transpose* are consistent. Students switch language per screen and can show a question bilingually, which helps students moving between mediums. Machine translation (for example, IndicTrans2 or Bhashini) is used only to produce drafts for human review; each content item carries a review status and unreviewed items are never shown. Hindi is the planned third language, added the same way.

**Limited internet.** The student app is a Progressive Web App installed from the browser on Android. A chapter pack of about 3 to 5 MB (graph, bilingual text, questions, small SVG diagrams) is downloaded once, in school over Wi-Fi or a shared hotspot. The mastery model and pathway policy run on the device, so the Readiness Check, Learn, Solve and Test all work with no connection. Attempts are queued locally and synchronised in small batches whenever a connection appears; the server replays them through the same engine code so offline and online results match. Honest limitations: new content and the teacher's Gap Map need connectivity, a student's progress reaches the teacher only after that device syncs, and the first download needs a connection somewhere.

**Devices and classrooms.** Mobile-first layout tested on low-end Android browsers, under 1 MB of application code and no video. A shared-device mode holds several student profiles behind four-digit PINs on one family phone. For students with no device, the teacher prints the Readiness Check and enters answers in a tap grid, so they still appear on the Gap Map. Group sizes and the Gap Map are designed for sections of 40 to 60.

### Question 6

**Which tech stack are you using for frontend, backend, database, and AI/ML, and why? Briefly describe how you'll structure your data (students, topics, questions, progress).**

**Frontend:** React with TypeScript and Vite, built as a Progressive Web App using Workbox for the service worker and Dexie (IndexedDB) for offline storage, styled with Tailwind CSS. Chosen because it installs from the browser on low-end Android phones without an app store, keeps the bundle small, and supports full offline operation.

**Shared engine:** a TypeScript package (`@setu/engine`) containing the concept-graph utilities, Bayesian Knowledge Tracing update, Readiness Check traversal, pathway and difficulty policy and re-check scheduler. The same code runs in the browser offline and on the server, so mastery estimates are identical everywhere, and it is small enough to unit-test exhaustively.

**Backend:** Node.js with Fastify (TypeScript), Prisma ORM, JWT authentication with role-based access, and REST endpoints for sync batches, teacher views and content packs. Chosen because one language across frontend, engine and backend lets a student team move fast, and a single service is sufficient for the first version.

**Database:** PostgreSQL. Students, attempts and mastery states are relational with strong constraints and auditing needs. Content (graph, resources, questions) is authored as versioned JSON and YAML in the repository and loaded into the database and into chapter packs.

**AI and ML:** BKT and the rule policy live in the engine; Python with numpy, pandas, networkx and pyBKT is used for offline simulation, parameter fitting and evaluation notebooks. Reserved for later: item response theory calibration and LLM-assisted drafting of explanations and translations, always with teacher review.

**Supporting:** Docker Compose, GitLab CI for tests and builds, object storage for content packs, hosting in an Indian region.

**Data structure.** *School* has *Classrooms*; *Classroom* has *Students*; *Teachers* are assigned to Classrooms with a role, which defines permissions. *Board/Syllabus* has *Subjects*, *Chapters* and *Concepts*; *ConceptPrerequisite* links prerequisite to dependent concepts and forms the graph. Each Concept has *Resources* (explanation, worked example, hint; language; the misconception it targets; review status) and *Questions* (difficulty 1 to 3, type, template parameters, language variants, board tags, review status) with *Options* that carry `is_correct` and a `misconception_code`. Each *Attempt* records student, question, chosen option or value, correctness, hints used, time, mode (readiness, solve, test, re-check), device timestamp and sync time. *MasteryState* holds, per student and concept, the current probability, attempt count, mastery date and whether it came from the model or a teacher override. *Recommendation* records what was suggested, for which concept, at which difficulty, with the rule that fired and a plain-language reason. *TeacherAction* logs overrides, assignments, mark-taught events and group edits; *RecheckSchedule* holds spaced re-checks; *SyncLog* tracks device batches.

These tables support the whole loop: attempts update mastery through BKT; mastery across the graph yields each student's frontier and gaps; the policy writes recommendations with reasons; the Gap Map is a query over mastery by classroom and concept; groups come from each student's lowest unmastered prerequisite and most frequent misconception; and teacher actions feed back into mastery and scheduling.

### Question 7

**How will you test that your recommendations are accurate, and how will you keep student data secure?**

**Testing recommendation accuracy.**

*Offline evaluation and simulation (Build round, before any real student).* We generate synthetic students with gaps planted at random nodes of the prerequisite graph and answer behaviour drawn from BKT parameters, then measure the Readiness Check's recall and precision in finding the planted gaps and the median number of items used, against a fixed 12-item test (target: at least 0.85 recall for single gaps within 12 items). We simulate learners with different learning rates to measure items-to-mastery and the share of attempts in the 60 to 80 percent accuracy band under the difficulty ladder versus fixed difficulty. The engine has unit tests with hand-computed BKT updates, golden test vectors shared between browser and server builds, and replay tests that re-run stored attempts and must reproduce stored mastery values.

*Content and language quality.* Every question and explanation is reviewed by two mathematics teachers for concept tag, difficulty, misconception coding and Telugu wording; we record inter-rater agreement and revise items that fall below it. Nothing machine-drafted is shown to students without this review.

*Small supervised pilot (Prove round and after).* One chapter, two sections, two to three weeks, with school and parental consent. Learning gain is measured by a teacher-written pre-test and post-test, not by Setu's own questions, with a comparison section where the school permits. Once logs exist we check calibration (predicted versus observed probability of a correct answer, Brier score) and refit BKT parameters per concept. Teacher usefulness is measured by time to identify students needing help with and without the Gap Map, the share of suggested groups accepted, edited or dismissed, re-check results after "mark taught", and a short usability survey. Student usability is measured by session completion, time per session, hint use and short interviews in Telugu and English.

**Keeping student data secure.**

*Data minimisation:* students are recorded by first name, roll number, class and section only; no phone numbers, emails, addresses, photographs or third-party identifiers; analytics use pseudonymous IDs.

*Consent and permissions:* the school creates accounts and collects parental consent through its existing channels; students under 18 are never asked to accept terms themselves. The design follows India's Digital Personal Data Protection Act, 2023, which requires verifiable parental consent for children's data and prohibits tracking and targeted advertising aimed at children; Setu has no advertising, no behavioural tracking and no data sharing or sale.

*Encryption and authentication:* TLS for all traffic; encryption at rest for the database and backups; teacher passwords hashed with Argon2; short-lived JWT access tokens with refresh tokens; four-digit PINs for student profiles on shared devices; the offline store holds only the signed-in students' own data.

*Access control and audit:* roles for student, teacher, coordinator and content author; teachers see only their assigned classrooms; coordinators see aggregates without individual attempts; every override, assignment and export is logged with who and when.

*Retention and rights:* attempt-level data is kept for the academic year plus one year for continuity, then aggregated or deleted; schools can request export or deletion at any time; data is hosted in an Indian region.

---

*End of submission.*
