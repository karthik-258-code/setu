// Runs `pnpm --filter <name> <script>` only when the workspace package exists.
// Usage: node scripts/run-if-present.mjs <packageDir> <packageName> <script>
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const [dir, name, script] = process.argv.slice(2);

if (!dir || !name || !script) {
  console.error("usage: node scripts/run-if-present.mjs <packageDir> <packageName> <script>");
  process.exit(2);
}

if (!existsSync(join(dir, "package.json"))) {
  console.log(`${name} is not created yet; skipping "${script}".`);
  process.exit(0);
}

const result = spawnSync("pnpm", ["--filter", name, script], { stdio: "inherit" });
process.exit(result.status ?? 1);
