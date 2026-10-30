/**
 * School roster CSV (onboarding, DEPLOYMENT section 3): one row per student with
 * `class,section,roll,first_name[,lang]`. Only the PII the submission allows is read. Pure
 * functions; `import-roster.ts` writes the result to the database.
 */

export type ClassLevel = 6 | 7 | 8 | 9 | 10;
export type RosterLang = "en" | "te" | "hi";

export interface RosterRow {
  classLevel: ClassLevel;
  section: string;
  rollNo: string;
  firstName: string;
  lang: RosterLang;
}

export interface RosterError {
  line: number;
  message: string;
}

const REQUIRED = ["class", "section", "roll", "first_name"] as const;

/** Splits one CSV line; supports double-quoted fields with commas and doubled quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field.trim());
  return out;
}

/** Parses and validates a roster; every problem is reported with its line number. */
export function parseRoster(text: string): { rows: RosterRow[]; errors: RosterError[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => l.trim() !== "");
  if (headerIndex < 0) return { rows: [], errors: [{ line: 1, message: "the file is empty" }] };
  const header = splitCsvLine(lines[headerIndex] ?? "").map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: headerIndex + 1, message: `missing column(s): ${missing.join(", ")}` }] };
  }
  const col = (name: string) => header.indexOf(name);
  const rows: RosterRow[] = [];
  const errors: RosterError[] = [];
  const seen = new Set<string>();
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    if (raw.trim() === "") continue;
    const line = i + 1;
    const cells = splitCsvLine(raw);
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "") : "");
    const classLevel = Number(get("class"));
    const section = get("section").toUpperCase();
    const rollNo = get("roll").replace(/^0+(?=\d)/, "");
    const firstName = get("first_name");
    const lang = (get("lang") || "en").toLowerCase();
    const problems: string[] = [];
    if (![6, 7, 8, 9, 10].includes(classLevel)) problems.push("class must be 6 to 10");
    if (!/^[A-Z0-9]{1,5}$/.test(section)) problems.push("section must be 1 to 5 letters or digits");
    if (!/^\d{1,3}$/.test(rollNo)) problems.push("roll must be a number");
    if (firstName === "" || firstName.length > 40) problems.push("first_name must be 1 to 40 characters");
    if (lang !== "en" && lang !== "te" && lang !== "hi") problems.push("lang must be en, te or hi");
    const key = `${classLevel}|${section}|${rollNo}`;
    if (problems.length === 0 && seen.has(key)) problems.push(`duplicate roll ${rollNo} in class ${classLevel} ${section}`);
    if (problems.length > 0) {
      errors.push({ line, message: problems.join("; ") });
      continue;
    }
    seen.add(key);
    rows.push({ classLevel: classLevel as ClassLevel, section, rollNo, firstName, lang: lang as RosterLang });
  }
  return { rows, errors };
}

/** Letters and digits that are hard to misread on a printed slip (no 0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A classroom code such as `8B-KTM`: class and section, then three random characters. */
export function classroomCode(classLevel: ClassLevel, section: string, randomInt: (max: number) => number): string {
  let suffix = "";
  for (let i = 0; i < 3; i++) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)] ?? "X";
  return `${classLevel}${section}-${suffix}`;
}

/** A four-digit PIN from 1000 to 9999. */
export function newPin(randomInt: (max: number) => number): string {
  return String(1000 + randomInt(9000));
}
