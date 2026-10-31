import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import type { StudentEvent } from "@setu/engine";
import { studentEventSchema } from "@setu/shared";
import { z } from "zod";
import { planDemoProgress, remapDemoEventsToRoster } from "./demo-progress";

const CLASSROOM_CODE = "DEMO8B";
const CHAPTER_ID = "CH.M8.LINEAR_EQ_ONE_VAR";
const DEMO_SEED_PATH = fileURLToPath(new URL("../../../apps/web/public/demo/seed.json", import.meta.url));
const prisma = new PrismaClient();

const seedSchema = z.object({
  chapterId: z.string(),
  students: z.array(z.object({ studentId: z.string(), rollNo: z.string() })),
  events: z.array(studentEventSchema),
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Set it to the demo Postgres connection string first.");
  }

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const allowExistingActivity = args.includes("--allow-existing-activity");
  if (args.some((arg) => arg !== "--apply" && arg !== "--allow-existing-activity")) {
    throw new Error("Supported options are --apply and --allow-existing-activity.");
  }
  if (allowExistingActivity && !apply) throw new Error("--allow-existing-activity requires --apply.");

  let seed: z.infer<typeof seedSchema>;
  try {
    seed = seedSchema.parse(JSON.parse(readFileSync(DEMO_SEED_PATH, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error("Demo seed file is missing. Run `pnpm content:pack` from the repository root, then retry.");
    }
    throw new Error(`Demo seed file is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (seed.chapterId !== CHAPTER_ID) throw new Error(`Expected demo chapter ${CHAPTER_ID}, got ${seed.chapterId}.`);

  const classroom = await prisma.classroom.findUnique({
    where: { code: CLASSROOM_CODE },
    include: { students: { select: { id: true, rollNo: true } } },
  });
  if (!classroom) throw new Error(`Classroom ${CLASSROOM_CODE} was not found. Run the database roster seed first.`);
  const launched = Array.isArray(classroom.launchedChapters)
    ? classroom.launchedChapters.some(
        (entry) => typeof entry === "object" && entry !== null && "chapterId" in entry && entry.chapterId === CHAPTER_ID,
      )
    : false;
  if (!launched) throw new Error(`${CLASSROOM_CODE} has not launched ${CHAPTER_ID}; refusing to add demo progress.`);

  const events = remapDemoEventsToRoster(seed.events as StudentEvent[], seed.students, classroom.students, ["1"]);
  const studentIds = [...new Set(events.map((event) => event.studentId))];
  const existing = await prisma.event.findMany({
    where: {
      OR: [
        { studentId: { in: studentIds } },
        { id: { in: events.map((event) => event.id) } },
      ],
    },
    select: { id: true, studentId: true },
  });
  let plan: ReturnType<typeof planDemoProgress>;
  try {
    plan = planDemoProgress(events, existing, { allowExistingActivity });
  } catch (error) {
    throw new Error(`Cannot safely seed ${CLASSROOM_CODE}: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`Classroom: ${CLASSROOM_CODE} (${classroom.students.length} database students)`);
  console.log(`Generated activity: ${events.length} events for ${new Set(events.map((event) => event.studentId)).size} students`);
  if (allowExistingActivity) console.log("Appending generated activity to students with existing activity.");
  console.log(`Skipped students with existing activity: ${plan.skippedStudents}`);
  console.log(`New events to insert: ${plan.pending.length}`);

  if (!apply) {
    console.log("Dry run only; database unchanged. Add --apply to insert the events.");
    return;
  }
  if (plan.pending.length === 0) {
    console.log("Demo progress is already present; database unchanged.");
    return;
  }

  const data: Prisma.EventCreateManyInput[] = plan.pending.map((event) => ({
    id: event.id,
    studentId: event.studentId,
    type: event.type,
    payload: event as unknown as Prisma.InputJsonValue,
    ts: new Date(event.ts),
  }));
  const result = await prisma.event.createMany({ data, skipDuplicates: true });
  console.log(`Inserted ${result.count} demo events for Class 8B rolls 2-46.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
