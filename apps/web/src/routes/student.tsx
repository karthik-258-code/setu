import { Outlet } from "react-router-dom";
import { Placeholder } from "./placeholder";

export function StudentLayout() {
  return <Outlet />;
}

export const StudentLogin = () => <Placeholder name="student-login" />;
export const StudentProfiles = () => <Placeholder name="student-profiles" />;
export const StudentHome = () => <Placeholder name="student-home" />;
export const StudentReadiness = () => <Placeholder name="student-readiness" />;
export const StudentLearn = () => <Placeholder name="student-learn" />;
export const StudentSolve = () => <Placeholder name="student-solve" />;
export const StudentTest = () => <Placeholder name="student-test" />;
export const StudentProgress = () => <Placeholder name="student-progress" />;
