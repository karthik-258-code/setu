/**
 * Pack builder (`pnpm content:pack`, ARCHITECTURE 6.3). Validates the content, expands the
 * templates and writes one minified pack per chapter, plus an `index.json` listing each pack's
 * version and size, to apps/web/public/packs/ and apps/api/packs/. Both folders are build output
 * (gitignored) and are rebuilt from scratch on every run. Prints each pack's size and question
 * count, and fails without writing anything if a pack is over 5 MB.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_DIR, loadContent } from "./load";
import { MAX_PACK_BYTES, buildPack, packSources, questionCounts } from "./pack";
import { validateContent } from "./validate";

const REPO_ROOT = resolve(CONTENT_DIR, "..", "..", "..");

/** Where packs are written: the web app serves them, the API reads them (task 4.3). */
export const PACK_DIRS = [
  join(REPO_ROOT, "apps", "web", "public", "packs"),
  join(REPO_ROOT, "apps", "api", "packs"),
];

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main(): void {
  const { input, errors: loadErrors } = loadContent();
  const errors = [...loadErrors, ...validateContent(input)];
  if (errors.length > 0) {
    for (const error of errors) console.error(`${error.file}: ${error.message}`);
    console.error("\nrefusing to build packs from invalid content");
    process.exit(1);
  }
  const sources = packSources(input);
  if (sources.chapters.length === 0) {
    console.log("0 packs built");
    return;
  }

  const builtAt = new Date().toISOString();
  const counts = new Map(
    questionCounts(sources.concepts, sources.chapters, sources.questions).map((c) => [
      c.chapterId,
      c,
    ]),
  );
  const files = sources.chapters.map((chapter) => {
    const pack = buildPack(sources, chapter.id, builtAt);
    const json = JSON.stringify(pack);
    return { pack, json, bytes: Buffer.byteLength(json) };
  });

  let oversized = 0;
  for (const { pack, bytes } of files) {
    const c = counts.get(pack.chapterId);
    console.log(
      `${pack.chapterId}: ${kb(bytes)}, ${c?.total ?? 0} questions (${c?.handAuthored ?? 0} hand-authored, ${c?.generated ?? 0} generated), ${pack.resources.length} resources, version ${pack.packVersion}`,
    );
    if (bytes > MAX_PACK_BYTES) {
      console.error(`${pack.chapterId}: ${kb(bytes)} is over the ${kb(MAX_PACK_BYTES)} limit`);
      oversized += 1;
    }
  }
  if (oversized > 0) {
    console.error(`\n${oversized} pack(s) over the size limit; nothing written`);
    process.exit(1);
  }

  const index = files.map(({ pack, bytes }) => ({
    chapterId: pack.chapterId,
    packVersion: pack.packVersion,
    bytes,
  }));
  for (const dir of PACK_DIRS) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const { pack, json } of files) writeFileSync(join(dir, `${pack.chapterId}.json`), json);
    writeFileSync(join(dir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  }
  const where = PACK_DIRS.map((dir) => relative(REPO_ROOT, dir)).join(" and ");
  console.log(`\n${files.length} packs built into ${where}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
