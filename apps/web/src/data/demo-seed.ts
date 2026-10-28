import type { Lang } from "@setu/engine";
import type { ClassroomSummary } from "@setu/shared";

/**
 * The demo classroom: a two-student stub (Anjali and Ravi) until task 6.1 adds the full seeded
 * classroom with their events and 44 synthetic students.
 */
export const DEMO_CLASSROOM: ClassroomSummary = {
  id: "demo-8b",
  classLevel: 8,
  section: "B",
  code: "DEMO8B",
  launchedChapters: [
    { chapterId: "CH.M8.LINEAR_EQ_ONE_VAR", trimmed: [], launchedAt: "2026-10-27T03:30:00.000Z" },
  ],
};

export const DEMO_TEACHER = {
  teacherId: "demo-teacher",
  email: "teacher@demo.setu.app",
  password: "setu-demo",
} as const;

export interface DemoStudent {
  studentId: string;
  firstName: string;
  rollNo: string;
  lang: Lang;
  /** Demo-only PIN, given out with the demo script. Real PINs are only ever stored hashed (3.2). */
  pin: string;
}

export const DEMO_STUDENTS: readonly DemoStudent[] = [
  { studentId: "demo-anjali", firstName: "Anjali", rollNo: "1", lang: "te", pin: "1111" },
  { studentId: "demo-ravi", firstName: "Ravi", rollNo: "2", lang: "te", pin: "2222" },
];
