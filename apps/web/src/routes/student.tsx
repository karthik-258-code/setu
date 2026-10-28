import { Outlet } from "react-router-dom";
import { StudentProvider } from "../student/student-context";
import { Placeholder } from "./placeholder";

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
export const StudentLearn = () => <Placeholder name="student-learn" />;
export const StudentSolve = () => <Placeholder name="student-solve" />;
export const StudentTest = () => <Placeholder name="student-test" />;
export const StudentProgress = () => <Placeholder name="student-progress" />;
