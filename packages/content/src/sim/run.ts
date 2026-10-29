/**
 * `pnpm sim`: builds the Class 8 pack from the content, runs the simulation (6.2) for 1,000
 * synthetic students and writes docs/EVALUATION.md.
 */
import { writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { DEMO_CHAPTER_ID } from "../demo/seed";
import { CONTENT_DIR, loadContent } from "../load";
import { buildPack, packSources } from "../pack";
import { validateContent } from "../validate";
import { renderEvaluation, runSimulation } from "./simulate";

const REPO_ROOT = resolve(CONTENT_DIR, "..", "..", "..");
const STUDENTS = 1000;
const SEED = 20261029;

const { input, errors: loadErrors } = loadContent();
const errors = [...loadErrors, ...validateContent(input)];
if (errors.length > 0) {
  for (const error of errors) console.error(`${error.file}: ${error.message}`);
  console.error("\nrefusing to simulate on invalid content");
  process.exit(1);
}

const pack = buildPack(packSources(input), DEMO_CHAPTER_ID, "2026-10-29T00:00:00.000Z");
const started = Date.now();
const report = runSimulation(pack, DEMO_CHAPTER_ID, STUDENTS, SEED);
const out = join(REPO_ROOT, "docs", "EVALUATION.md");
writeFileSync(out, renderEvaluation(report));
for (const r of report.readiness) {
  console.log(`${r.kind} gaps: recall ${(r.recall * 100).toFixed(1)}%, median ${r.medianItems} items`);
}
console.log(`wrote ${relative(REPO_ROOT, out)} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
