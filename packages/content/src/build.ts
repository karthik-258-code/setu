/**
 * Pack builder (`pnpm content:pack`). Task 0.3 only walks the chapter list; writing packs to
 * apps/web/public/packs/ and apps/api/packs/ arrives with task 2.7. Output directories are
 * created only when there is something to write, so nothing is created here.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chaptersFileSchema } from "./schema";
import { loadContent } from "./load";
import { validateContent } from "./validate";

function main(): void {
  const { input, errors: loadErrors } = loadContent();
  const errors = [...loadErrors, ...validateContent(input)];
  if (errors.length > 0) {
    for (const error of errors) console.error(`${error.file}: ${error.message}`);
    console.error("\nrefusing to build packs from invalid content");
    process.exit(1);
  }
  const chapters = chaptersFileSchema.parse(input.chapters);
  if (chapters.length > 0) {
    console.error(`${chapters.length} chapter(s) found, but pack writing is task 2.7.`);
    process.exit(1);
  }
  console.log("0 packs built");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
