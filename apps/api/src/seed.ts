/**
 * `pnpm --filter @setu/api db:seed` (task 4.1): one school, Class 8 B with 46 students and the
 * Class 8 chapter launched, Class 9 A with 40, one teacher (both classes) and one coordinator.
 * Idempotent: re-running updates rows by their unique keys. Demo PINs only; never real ones.
 */
import { PrismaClient } from "@prisma/client";
import { hashSecret } from "./auth";

const NAMES = [
  "Anjali", "Ravi", "Lakshmi", "Suresh", "Kavya", "Arjun", "Divya", "Kiran", "Swathi", "Mahesh",
  "Sravani", "Naveen", "Pooja", "Rahul", "Bhavana", "Sai", "Harika", "Vamsi", "Keerthi", "Ajay",
  "Sneha", "Pavan", "Meghana", "Teja", "Sindhu", "Ganesh", "Anusha", "Vinay", "Ramya", "Srikanth",
  "Navya", "Charan", "Deepika", "Manoj", "Lavanya", "Rakesh", "Priya", "Abhinav", "Haritha", "Gopi",
  "Mounika", "Nikhil", "Tejaswini", "Yashwanth", "Sahithi", "Venkat",
];

const CLASS8_CHAPTER = "CH.M8.LINEAR_EQ_ONE_VAR";

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.upsert({
    where: { id: "school-demo" },
    create: { id: "school-demo", name: "ZPHS Demo, Hyderabad", board: "TS_SCERT", district: "Hyderabad" },
    update: {},
  });
  const password = await hashSecret("setu-demo");
  const teacher = await prisma.teacher.upsert({
    where: { email: "teacher@demo.setu.app" },
    create: { schoolId: school.id, name: "Lakshmi", email: "teacher@demo.setu.app", passwordHash: password },
    update: { passwordHash: password },
  });
  await prisma.teacher.upsert({
    where: { email: "coordinator@demo.setu.app" },
    create: {
      schoolId: school.id,
      name: "Coordinator",
      email: "coordinator@demo.setu.app",
      passwordHash: password,
      role: "coordinator",
    },
    update: { passwordHash: password, role: "coordinator" },
  });

  const classes = [
    { code: "DEMO8B", classLevel: 8, section: "B", students: 46, pinBase: 3000, launch: CLASS8_CHAPTER },
    { code: "DEMO9A", classLevel: 9, section: "A", students: 40, pinBase: 4000, launch: null },
  ];
  for (const c of classes) {
    const launchedChapters = c.launch
      ? [{ chapterId: c.launch, trimmed: [], launchedAt: "2026-10-27T03:30:00.000Z" }]
      : [];
    const classroom = await prisma.classroom.upsert({
      where: { code: c.code },
      create: { schoolId: school.id, classLevel: c.classLevel, section: c.section, code: c.code, launchedChapters },
      update: {},
    });
    await prisma.teacherAssignment.upsert({
      where: { teacherId_classroomId: { teacherId: teacher.id, classroomId: classroom.id } },
      create: { teacherId: teacher.id, classroomId: classroom.id },
      update: {},
    });
    for (let roll = 1; roll <= c.students; roll++) {
      const pin = c.code === "DEMO8B" && roll <= 2 ? String(1111 * roll) : String(c.pinBase + roll);
      const pinHash = await hashSecret(pin);
      const firstName = NAMES[(roll - 1 + (c.classLevel === 9 ? 5 : 0)) % NAMES.length] ?? `Student ${roll}`;
      await prisma.student.upsert({
        where: { classroomId_rollNo: { classroomId: classroom.id, rollNo: String(roll) } },
        create: { classroomId: classroom.id, firstName, rollNo: String(roll), pinHash, lang: roll % 3 === 0 ? "en" : "te" },
        update: { pinHash },
      });
    }
    console.log(`${c.code}: ${c.students} students`);
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
