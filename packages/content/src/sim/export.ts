import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { mulberry32 } from "@setu/engine";
import { DEMO_CHAPTER_ID } from "../demo/seed";
import { CONTENT_DIR, loadContent } from "../load";
import { buildPack, packSources } from "../pack";
import { validateContent } from "../validate";
import { simulateReadinessCohort } from "./simulate";

const REPO_ROOT = resolve(CONTENT_DIR, "..", "..", "..");
const OUT = join(REPO_ROOT, "sim", "data", "readiness-synthetic.csv");
const SEED = 20261029;
const STUDENTS = 1000;

const { input, errors: loadErrors } = loadContent();
const errors = [...loadErrors, ...validateContent(input)];
if (errors.length > 0) {
  for (const error of errors) console.error(`${error.file}: ${error.message}`);
  console.error("\nrefusing to export logs from invalid content");
  process.exit(1);
}

const pack = buildPack(packSources(input), DEMO_CHAPTER_ID, "2026-10-29T00:00:00.000Z");
const outcomes = simulateReadinessCohort(pack, DEMO_CHAPTER_ID, STUDENTS, mulberry32(SEED));
const attempts = outcomes.flatMap((outcome) => outcome.attempts);
const order = new Map<string, number>();
const lines = [
  "user_id,skill_name,correct,order_id,difficulty,question_id",
  ...attempts.map((attempt) => {
    const key = `${attempt.studentId}\t${attempt.conceptId}`;
    const orderId = order.get(key) ?? 0;
    order.set(key, orderId + 1);
    return [
      attempt.studentId,
      attempt.conceptId,
      attempt.correct ? 1 : 0,
      orderId,
      attempt.difficulty,
      attempt.questionId,
    ].join(",");
  }),
];
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${lines.join("\n")}\n`, "utf8");
console.log(`Exported ${attempts.length} synthetic readiness responses to ${OUT}`);
