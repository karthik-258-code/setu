/**
 * `pnpm --filter @setu/api db:import -- <roster.csv> --school <schoolId> [--teacher <email>] [--reset-pins]`
 *
 * Creates missing classrooms (class + section) for the school and adds or updates students by
 * roll number. New students get a random 4-digit PIN; existing ones keep theirs unless
 * `--reset-pins`. Writes `<roster>.pins.csv` (classroom code, roll, first name, PIN) for printing
 * slips: print it, hand the slips out, then delete the file. PINs are stored only as hashes.
 * Nothing is written when the CSV has errors.
 */
import { randomInt } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { hashSecret } from "./auth";
import { classroomCode, newPin, parseRoster } from "./roster";
import type { RosterRow } from "./roster";

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const args = process.argv.slice(2).filter((a) => a !== "--");
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true);
const schoolId = argValue(args, "--school");
const teacherEmail = argValue(args, "--teacher");
const resetPins = args.includes("--reset-pins");
if (!file || !schoolId) {
  console.error("usage: db:import -- <roster.csv> --school <schoolId> [--teacher <email>] [--reset-pins]");
  process.exit(1);
}

const { rows, errors } = parseRoster(await readFile(file, "utf8"));
if (errors.length > 0) {
  for (const e of errors) console.error(`${file}:${e.line}: ${e.message}`);
  console.error(`\n${errors.length} problem(s); nothing imported`);
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new Error(`Unknown school ${schoolId}`);
  const teacher = teacherEmail ? await prisma.teacher.findUnique({ where: { email: teacherEmail } }) : null;
  if (teacherEmail && !teacher) throw new Error(`Unknown teacher ${teacherEmail}`);

  const byClass = new Map<string, RosterRow[]>();
  for (const row of rows) {
    const key = `${row.classLevel}|${row.section}`;
    byClass.set(key, [...(byClass.get(key) ?? []), row]);
  }

  const slips: string[] = ["class,section,classroom_code,roll,first_name,pin"];
  let created = 0;
  let updated = 0;
  for (const classRows of byClass.values()) {
    const first = classRows[0];
    if (!first) continue;
    let classroom = await prisma.classroom.findFirst({
      where: { schoolId, classLevel: first.classLevel, section: first.section },
    });
    if (!classroom) {
      let code = classroomCode(first.classLevel, first.section, randomInt);
      while (await prisma.classroom.findUnique({ where: { code } })) {
        code = classroomCode(first.classLevel, first.section, randomInt);
      }
      classroom = await prisma.classroom.create({
        data: { schoolId, classLevel: first.classLevel, section: first.section, code },
      });
      console.log(`created classroom ${code} (Class ${first.classLevel} ${first.section})`);
    }
    if (teacher) {
      await prisma.teacherAssignment.upsert({
        where: { teacherId_classroomId: { teacherId: teacher.id, classroomId: classroom.id } },
        create: { teacherId: teacher.id, classroomId: classroom.id },
        update: {},
      });
    }
    for (const row of classRows) {
      const where = { classroomId_rollNo: { classroomId: classroom.id, rollNo: row.rollNo } };
      const existing = await prisma.student.findUnique({ where });
      let pin = "";
      if (!existing || resetPins) pin = newPin(randomInt);
      const pinHash = pin === "" ? undefined : await hashSecret(pin);
      if (existing) {
        await prisma.student.update({
          where,
          data: { firstName: row.firstName, lang: row.lang, ...(pinHash ? { pinHash } : {}) },
        });
        updated += 1;
      } else {
        await prisma.student.create({
          data: { classroomId: classroom.id, rollNo: row.rollNo, firstName: row.firstName, lang: row.lang, pinHash: pinHash ?? "" },
        });
        created += 1;
      }
      if (pin !== "") {
        const name = row.firstName.includes(",") ? `"${row.firstName.replace(/"/g, '""')}"` : row.firstName;
        slips.push(`${row.classLevel},${row.section},${classroom.code},${row.rollNo},${name},${pin}`);
      }
    }
  }
  const out = `${file}.pins.csv`;
  await writeFile(out, `${slips.join("\n")}\n`);
  console.log(`${created} students created, ${updated} updated; ${slips.length - 1} PIN slip(s) in ${out}`);
  console.log("Print the slips, hand them out, then delete that file.");
} finally {
  await prisma.$disconnect();
}
