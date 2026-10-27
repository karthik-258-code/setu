import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentError, ContentInput } from "./validate";

export const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

function readJson(rel: string, errors: ContentError[]): unknown {
  const path = join(CONTENT_DIR, rel);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push({ file: rel, message: `cannot read JSON: ${(error as Error).message}` });
    return undefined;
  }
}

function readFolder(folder: string, errors: ContentError[]): Record<string, unknown> {
  const dir = join(CONTENT_DIR, folder);
  const out: Record<string, unknown> = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    const rel = relative(CONTENT_DIR, join(dir, name)).split("\\").join("/");
    out[rel] = readJson(rel, errors);
  }
  return out;
}

/** Reads everything under `content/`. Unreadable or malformed JSON is reported, not thrown. */
export function loadContent(): { input: ContentInput; errors: ContentError[] } {
  const errors: ContentError[] = [];
  const input: ContentInput = {
    concepts: readJson("graph/concepts.json", errors),
    chapters: readJson("graph/chapters.json", errors),
    misconceptions: readJson("misconceptions.json", errors),
    reasons: readJson("reasons.json", errors),
    questions: readFolder("questions", errors),
    templates: readFolder("templates", errors),
    resources: readFolder("resources", errors),
  };
  return { input, errors };
}
