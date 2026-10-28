import {
  refreshRequestSchema,
  studentLoginRequestSchema,
  teacherLoginRequestSchema,
} from "@setu/shared";
import type { RefreshResponse, StudentLoginResponse, TeacherLoginResponse } from "@setu/shared";
import type { FastifyPluginAsync } from "fastify";
import { issueToken, verifySecret, verifyToken } from "../auth";
import type { Role } from "../auth";
import { nowSeconds } from "../deps";
import type { ApiDeps } from "../deps";
import { ApiError, parseOr400 } from "../errors";

const invalid = () => new ApiError(401, "INVALID_CREDENTIALS", "Wrong credentials");

/** POST /auth/teacher/login, /auth/student/login, /auth/refresh (ARCHITECTURE 8.1). */
export const authRoutes: FastifyPluginAsync<{ deps: ApiDeps }> = async (app, { deps }) => {
  const pair = (role: Role, sub: string) => {
    const now = nowSeconds(deps);
    return {
      accessToken: issueToken(role, "access", sub, deps.tokenSecret, now),
      refreshToken: issueToken(role, "refresh", sub, deps.tokenSecret, now),
    };
  };

  app.post("/auth/teacher/login", async (request): Promise<TeacherLoginResponse> => {
    const body = parseOr400(teacherLoginRequestSchema, request.body);
    const teacher = await deps.store.teacherByEmail(body.email);
    if (!teacher || !(await verifySecret(body.password, teacher.passwordHash))) throw invalid();
    return pair("teacher", teacher.id);
  });

  app.post("/auth/student/login", async (request): Promise<StudentLoginResponse> => {
    const body = parseOr400(studentLoginRequestSchema, request.body);
    const classroom = await deps.store.classroomByCode(body.classroomCode.trim());
    const student = classroom ? await deps.store.studentByRoll(classroom.id, body.rollNo.trim()) : undefined;
    if (!student || !(await verifySecret(body.pin, student.pinHash))) throw invalid();
    return {
      accessToken: pair("student", student.id).accessToken,
      student: {
        studentId: student.id,
        firstName: student.firstName,
        rollNo: student.rollNo,
        classroomId: student.classroomId,
        lang: student.lang,
      },
    };
  });

  app.post("/auth/refresh", async (request): Promise<RefreshResponse> => {
    const body = parseOr400(refreshRequestSchema, request.body);
    const claims = verifyToken(body.refreshToken, deps.tokenSecret, nowSeconds(deps));
    if (!claims || claims.kind !== "refresh") {
      throw new ApiError(401, "UNAUTHORIZED", "A valid refresh token is required");
    }
    const exists =
      claims.role === "teacher"
        ? await deps.store.teacherById(claims.sub)
        : await deps.store.studentById(claims.sub);
    if (!exists) throw new ApiError(401, "UNAUTHORIZED", "Unknown account");
    return pair(claims.role, claims.sub);
  });
};
