/**
 * Endpoint paths shared by the web client and the API (ARCHITECTURE 8.1).
 * `routes` are Fastify patterns; `paths` build concrete URLs (path plus query string).
 */
const seg = encodeURIComponent;

export const routes = {
  teacherLogin: "/auth/teacher/login",
  studentLogin: "/auth/student/login",
  refresh: "/auth/refresh",
  pack: "/packs/:chapterId",
  meState: "/me/state",
  sync: "/sync",
  classrooms: "/classrooms",
  launch: "/classrooms/:id/launch",
  gapMap: "/classrooms/:id/gapmap",
  groups: "/classrooms/:id/groups",
  evidence: "/classrooms/:id/students/:sid/evidence",
  events: "/classrooms/:id/events",
  weekly: "/classrooms/:id/weekly",
  health: "/health",
} as const;

export const paths = {
  teacherLogin: () => routes.teacherLogin,
  studentLogin: () => routes.studentLogin,
  refresh: () => routes.refresh,
  pack: (chapterId: string) => `/packs/${seg(chapterId)}`,
  meState: () => routes.meState,
  sync: () => routes.sync,
  classrooms: () => routes.classrooms,
  launch: (classroomId: string) => `/classrooms/${seg(classroomId)}/launch`,
  gapMap: (classroomId: string, chapterId: string) =>
    `/classrooms/${seg(classroomId)}/gapmap?chapterId=${seg(chapterId)}`,
  groups: (classroomId: string, chapterId: string) =>
    `/classrooms/${seg(classroomId)}/groups?chapterId=${seg(chapterId)}`,
  evidence: (classroomId: string, studentId: string, conceptId: string) =>
    `/classrooms/${seg(classroomId)}/students/${seg(studentId)}/evidence?conceptId=${seg(conceptId)}`,
  events: (classroomId: string) => `/classrooms/${seg(classroomId)}/events`,
  weekly: (classroomId: string, chapterId: string) =>
    `/classrooms/${seg(classroomId)}/weekly?chapterId=${seg(chapterId)}`,
  health: () => routes.health,
} as const;
