/**
 * Student profiles on a shared device (ARCHITECTURE 7.3). A profile holds only the PII the
 * submission allows: firstName, rollNo, classroomId, lang and the PIN hash.
 */
import type { Lang } from "@setu/engine";
import type { StudentProfile } from "@setu/shared";
import type { Profile, SetuDb } from "./db";
import { deviceSalt, hashPin } from "./pin";

const ACTIVE_KEY = "activeStudentId";

/** Stores (or replaces) a profile after a successful login, hashing the PIN with the device salt. */
export async function saveProfile(
  db: SetuDb,
  student: StudentProfile,
  pin: string,
): Promise<Profile> {
  const profile: Profile = {
    studentId: student.studentId,
    firstName: student.firstName,
    rollNo: student.rollNo,
    classroomId: student.classroomId,
    lang: student.lang,
    pinHash: await hashPin(pin, await deviceSalt(db)),
  };
  await db.profiles.put(profile);
  return profile;
}

/** Profiles on this device, by first name then roll number. */
export async function listProfiles(db: SetuDb): Promise<Profile[]> {
  return (await db.profiles.toArray()).sort(
    (a, b) => a.firstName.localeCompare(b.firstName) || a.rollNo.localeCompare(b.rollNo),
  );
}

/** True when `pin` matches the stored hash of the profile; false for an unknown profile. */
export async function checkPin(db: SetuDb, studentId: string, pin: string): Promise<boolean> {
  const profile = await db.profiles.get(studentId);
  if (!profile) return false;
  return profile.pinHash === (await hashPin(pin, await deviceSalt(db)));
}

export async function setActiveProfile(db: SetuDb, studentId: string | null): Promise<void> {
  if (studentId === null) await db.meta.delete(ACTIVE_KEY);
  else await db.meta.put({ key: ACTIVE_KEY, value: studentId });
}

/** The profile that is using the device now, if any. */
export async function activeProfile(db: SetuDb): Promise<Profile | undefined> {
  const id = (await db.meta.get(ACTIVE_KEY))?.value;
  return typeof id === "string" ? db.profiles.get(id) : undefined;
}

/** Remembers the language a student chose, so it comes back when they pick their profile. */
export async function setProfileLang(db: SetuDb, studentId: string, lang: Lang): Promise<void> {
  await db.profiles.update(studentId, { lang });
}
