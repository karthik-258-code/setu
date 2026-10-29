/**
 * Authorisation (ARCHITECTURE 8.4): a bearer access token with the right role, and for teacher
 * routes a classroom the teacher may see (assigned, or the school for a coordinator).
 */
import type { FastifyRequest } from "fastify";
import { verifyToken } from "./auth";
import type { Role, TokenClaims } from "./auth";
import { nowSeconds } from "./deps";
import type { ApiDeps } from "./deps";
import { ApiError } from "./errors";
import type { StoredClassroom, StoredStudent } from "./store";

export function claimsOf(deps: ApiDeps, request: FastifyRequest, role: Role): TokenClaims {
  const header = request.headers.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
  const claims = token === "" ? null : verifyToken(token, deps.tokenSecret, nowSeconds(deps));
  if (!claims || claims.kind !== "access") {
    throw new ApiError(401, "UNAUTHORIZED", "A valid access token is required");
  }
  if (claims.role !== role) throw new ApiError(403, "FORBIDDEN", `This route is for ${role}s`);
  return claims;
}

/** The classroom, if the signed-in teacher may see it: 404 when it does not exist, 403 otherwise. */
export async function teacherClassroom(
  deps: ApiDeps,
  request: FastifyRequest,
  classroomId: string,
): Promise<{ teacherId: string; classroom: StoredClassroom }> {
  const { sub } = claimsOf(deps, request, "teacher");
  const classroom = (await deps.store.classroomsForTeacher(sub)).find((c) => c.id === classroomId);
  if (classroom) return { teacherId: sub, classroom };
  if (await deps.store.classroomById(classroomId)) {
    throw new ApiError(403, "FORBIDDEN", "This classroom belongs to another teacher");
  }
  throw new ApiError(404, "NOT_FOUND", `Unknown classroom ${classroomId}`);
}

export async function signedInStudent(deps: ApiDeps, request: FastifyRequest): Promise<StoredStudent> {
  const { sub } = claimsOf(deps, request, "student");
  const student = await deps.store.studentById(sub);
  if (!student) throw new ApiError(401, "UNAUTHORIZED", "Unknown student");
  return student;
}
