import { Outlet } from "react-router-dom";
import { Placeholder } from "./placeholder";

export function TeacherLayout() {
  return <Outlet />;
}

export const TeacherLogin = () => <Placeholder name="teacher-login" />;
export const TeacherClassrooms = () => <Placeholder name="teacher-classrooms" />;
export const TeacherLaunch = () => <Placeholder name="teacher-launch" />;
export const TeacherGapMap = () => <Placeholder name="teacher-gapmap" />;
export const TeacherGroups = () => <Placeholder name="teacher-groups" />;
export const TeacherStudent = () => <Placeholder name="teacher-student" />;
export const TeacherPaperEntry = () => <Placeholder name="teacher-paper-entry" />;
export const TeacherWeekly = () => <Placeholder name="teacher-weekly" />;
