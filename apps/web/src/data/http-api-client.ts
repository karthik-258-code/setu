/**
 * `ApiClient` over the Setu API (ARCHITECTURE 7.4, 8.1). Tokens live in Dexie `meta`: the
 * teacher's access and refresh pair, and one access token per student who signed in online on
 * this device, so a shared phone can sync each student's events with their own token.
 */
import type {
  AttemptEvent,
  ContentPack,
  GapGroup,
  GapMap,
  StudentEvent,
  StudentState,
  TeacherEvent,
  WeeklyView,
} from "@setu/engine";
import { errorResponseSchema, packResponseSchema, syncResponseSchema } from "@setu/shared";
import type {
  ApiClient,
  ClassroomSummary,
  LaunchRequest,
  LaunchResponse,
  StudentLoginRequest,
  StudentLoginResponse,
  SyncResponse,
  TeacherLoginRequest,
  TeacherLoginResponse,
} from "@setu/shared";
import type { SetuDb } from "./db";
import { newId } from "./ids";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const TEACHER_TOKENS = "api:teacher";
const DEVICE_ID = "deviceId";
const studentTokenKey = (studentId: string) => `api:student:${studentId}`;
const enc = encodeURIComponent;

export class HttpApiClient implements ApiClient {
  private readonly base: string;
  private readonly db: SetuDb;
  private readonly fetchFn: FetchLike;
  private lastStudentId: string | null = null;

  constructor(baseUrl: string, db: SetuDb, fetchFn: FetchLike = (url, init) => fetch(url, init)) {
    this.base = baseUrl.replace(/\/+$/, "");
    this.db = db;
    this.fetchFn = fetchFn;
  }

  private async request<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token !== undefined) headers.authorization = `Bearer ${token}`;
    const response = await this.fetchFn(`${this.base}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    const json: unknown = text === "" ? undefined : JSON.parse(text);
    if (!response.ok) {
      const error = errorResponseSchema.safeParse(json);
      throw error.success
        ? new ApiRequestError(response.status, error.data.error.code, error.data.error.message)
        : new ApiRequestError(response.status, "HTTP_ERROR", `HTTP ${response.status}`);
    }
    return json as T;
  }

  /** A teacher request; an expired access token is refreshed once and the request repeated. */
  private async teacher<T>(method: string, path: string, body?: unknown): Promise<T> {
    const tokens = (await this.db.meta.get(TEACHER_TOKENS))?.value as TeacherLoginResponse | undefined;
    if (!tokens) throw new ApiRequestError(401, "UNAUTHORIZED", "The teacher is not signed in");
    try {
      return await this.request<T>(method, path, body, tokens.accessToken);
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.status !== 401) throw error;
      const fresh = await this.request<TeacherLoginResponse>("POST", "/auth/refresh", {
        refreshToken: tokens.refreshToken,
      });
      await this.db.meta.put({ key: TEACHER_TOKENS, value: fresh });
      return this.request<T>(method, path, body, fresh.accessToken);
    }
  }

  private async studentToken(studentId: string): Promise<string> {
    const token = (await this.db.meta.get(studentTokenKey(studentId)))?.value;
    if (typeof token !== "string") {
      throw new ApiRequestError(401, "UNAUTHORIZED", "Sign in once while online to send work");
    }
    return token;
  }

  private async deviceId(): Promise<string> {
    const stored = (await this.db.meta.get(DEVICE_ID))?.value;
    if (typeof stored === "string") return stored;
    const id = newId();
    await this.db.meta.put({ key: DEVICE_ID, value: id });
    return id;
  }

  async login(request: TeacherLoginRequest): Promise<TeacherLoginResponse> {
    const tokens = await this.request<TeacherLoginResponse>("POST", "/auth/teacher/login", request);
    await this.db.meta.put({ key: TEACHER_TOKENS, value: tokens });
    return tokens;
  }

  async studentLogin(request: StudentLoginRequest): Promise<StudentLoginResponse> {
    const response = await this.request<StudentLoginResponse>("POST", "/auth/student/login", request);
    await this.db.meta.put({ key: studentTokenKey(response.student.studentId), value: response.accessToken });
    this.lastStudentId = response.student.studentId;
    return response;
  }

  async getMyState(): Promise<StudentState> {
    if (this.lastStudentId === null) throw new ApiRequestError(401, "UNAUTHORIZED", "No student is signed in");
    return this.request<StudentState>("GET", "/me/state", undefined, await this.studentToken(this.lastStudentId));
  }

  async getPack(chapterId: string): Promise<ContentPack> {
    return packResponseSchema.parse(await this.request<unknown>("GET", `/packs/${enc(chapterId)}`)) as ContentPack;
  }

  /** Sends one student's events with that student's token. */
  async sync(events: StudentEvent[]): Promise<SyncResponse> {
    const students = [...new Set(events.map((e) => e.studentId))];
    const studentId = students[0];
    if (studentId === undefined) return { accepted: [], rejected: [], serverTime: new Date().toISOString() };
    if (students.length > 1) throw new Error("sync sends one student's events at a time");
    const raw = await this.request<unknown>(
      "POST",
      "/sync",
      { deviceId: await this.deviceId(), events },
      await this.studentToken(studentId),
    );
    return syncResponseSchema.parse(raw);
  }

  getClassrooms(): Promise<ClassroomSummary[]> {
    return this.teacher<ClassroomSummary[]>("GET", "/classrooms");
  }

  launchChapter(classroomId: string, request: LaunchRequest): Promise<LaunchResponse> {
    return this.teacher<LaunchResponse>("POST", `/classrooms/${enc(classroomId)}/launch`, request);
  }

  getGapMap(classroomId: string, chapterId: string): Promise<GapMap> {
    return this.teacher<GapMap>("GET", `/classrooms/${enc(classroomId)}/gapmap?chapterId=${enc(chapterId)}`);
  }

  getGroups(classroomId: string, chapterId: string): Promise<GapGroup[]> {
    return this.teacher<GapGroup[]>("GET", `/classrooms/${enc(classroomId)}/groups?chapterId=${enc(chapterId)}`);
  }

  getEvidence(classroomId: string, studentId: string, conceptId: string): Promise<AttemptEvent[]> {
    return this.teacher<AttemptEvent[]>(
      "GET",
      `/classrooms/${enc(classroomId)}/students/${enc(studentId)}/evidence?conceptId=${enc(conceptId)}`,
    );
  }

  async postTeacherEvent(classroomId: string, event: TeacherEvent): Promise<void> {
    await this.teacher<unknown>("POST", `/classrooms/${enc(classroomId)}/events`, event);
  }

  getWeekly(classroomId: string, chapterId: string): Promise<WeeklyView> {
    return this.teacher<WeeklyView>("GET", `/classrooms/${enc(classroomId)}/weekly?chapterId=${enc(chapterId)}`);
  }
}
