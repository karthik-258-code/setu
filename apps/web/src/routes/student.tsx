import { Outlet } from "react-router-dom";
import { StudentProvider } from "../student/student-context";

export function StudentLayout() {
  return (
    <StudentProvider>
      <Outlet />
    </StudentProvider>
  );
}

export { StudentLogin } from "./student-login";
export { StudentProfiles } from "./student-profiles";
export { StudentHome } from "./student-home";
export { StudentReadiness } from "./student-readiness";
export { StudentLearn } from "./student-learn";
export { StudentSolve } from "./student-solve";
export { StudentTest } from "./student-test";
export { StudentProgress } from "./student-progress";
