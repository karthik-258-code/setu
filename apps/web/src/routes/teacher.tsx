import { Outlet } from "react-router-dom";
import { TeacherProvider } from "../teacher/teacher-context";
import { Placeholder } from "./placeholder";

export function TeacherLayout() {
  return (
    <TeacherProvider>
      <Outlet />
    </TeacherProvider>
  );
}

export { TeacherLogin } from "./teacher-login";
export { TeacherClassrooms } from "./teacher-classrooms";
export const TeacherLaunch = () => <Placeholder name="teacher-launch" />;
export const TeacherGapMap = () => <Placeholder name="teacher-gapmap" />;
export const TeacherGroups = () => <Placeholder name="teacher-groups" />;
export const TeacherStudent = () => <Placeholder name="teacher-student" />;
export const TeacherPaperEntry = () => <Placeholder name="teacher-paper-entry" />;
export const TeacherWeekly = () => <Placeholder name="teacher-weekly" />;
