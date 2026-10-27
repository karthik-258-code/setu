import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { Demo, RoleChooser } from "./routes/pages";
import { Shell } from "./routes/shell";

type Page = ComponentType;

/** Student and teacher route groups are separate chunks, loaded on first visit. */
const student = <K extends keyof typeof import("./routes/student")>(name: K): RouteObject => ({
  lazy: async () => ({ Component: (await import("./routes/student"))[name] as Page }),
});
const teacher = <K extends keyof typeof import("./routes/teacher")>(name: K): RouteObject => ({
  lazy: async () => ({ Component: (await import("./routes/teacher"))[name] as Page }),
});

export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { index: true, element: <RoleChooser /> },
      { path: "demo", element: <Demo /> },
      {
        path: "s",
        lazy: async () => ({ Component: (await import("./routes/student")).StudentLayout }),
        children: [
          { path: "login", ...student("StudentLogin") },
          { path: "profiles", ...student("StudentProfiles") },
          { path: "home", ...student("StudentHome") },
          { path: "readiness/:chapterId", ...student("StudentReadiness") },
          { path: "learn/:conceptId", ...student("StudentLearn") },
          { path: "solve/:conceptId", ...student("StudentSolve") },
          { path: "test/:conceptId", ...student("StudentTest") },
          { path: "progress", ...student("StudentProgress") },
        ],
      },
      {
        path: "t",
        lazy: async () => ({ Component: (await import("./routes/teacher")).TeacherLayout }),
        children: [
          { path: "login", ...teacher("TeacherLogin") },
          { path: "classrooms", ...teacher("TeacherClassrooms") },
          { path: "classrooms/:id/launch", ...teacher("TeacherLaunch") },
          { path: "classrooms/:id/gapmap", ...teacher("TeacherGapMap") },
          { path: "classrooms/:id/groups", ...teacher("TeacherGroups") },
          { path: "classrooms/:id/students/:sid", ...teacher("TeacherStudent") },
          { path: "classrooms/:id/paper-entry", ...teacher("TeacherPaperEntry") },
          { path: "classrooms/:id/weekly", ...teacher("TeacherWeekly") },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
