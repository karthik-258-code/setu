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
export { TeacherLaunch } from "./teacher-launch";
export { TeacherGapMap } from "./teacher-gapmap";
export { TeacherGroups } from "./teacher-groups";
export { TeacherStudent } from "./teacher-student";
export { TeacherPaperEntry } from "./teacher-paper-entry";
export { TeacherWeekly } from "./teacher-weekly";
