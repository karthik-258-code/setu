// Placeholder CLI for `pnpm sim`. The real simulation harness lands in task 6.2.
import { stdout } from "node:process";

stdout.write(
  [
    "Setu simulation harness (not implemented until task 6.2).",
    "",
    "Usage: pnpm sim",
    "  Will run seeded simulated learners through the engine and write",
    "  docs/EVALUATION.md. Nothing is run or written yet.",
    "",
  ].join("\n"),
);
