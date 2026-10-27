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
import type {
  ClassroomSummary,
  LaunchRequest,
  LaunchResponse,
  StudentLoginRequest,
  StudentLoginResponse,
  SyncResponse,
  TeacherLoginRequest,
  TeacherLoginResponse,
} from "./dto";

/**
 * All network access goes through this interface (ARCHITECTURE 7.4).
 * `HttpApiClient` talks to apps/api; `LocalDemoApiClient` runs the engine over a seeded classroom.
 * The device id for `sync` is bound when the client is constructed.
 */
export interface ApiClient {
  login(request: TeacherLoginRequest): Promise<TeacherLoginResponse>;
  studentLogin(request: StudentLoginRequest): Promise<StudentLoginResponse>;
  getMyState(): Promise<StudentState>;
  getPack(chapterId: string): Promise<ContentPack>;
  sync(events: StudentEvent[]): Promise<SyncResponse>;
  getClassrooms(): Promise<ClassroomSummary[]>;
  launchChapter(classroomId: string, request: LaunchRequest): Promise<LaunchResponse>;
  getGapMap(classroomId: string, chapterId: string): Promise<GapMap>;
  getGroups(classroomId: string, chapterId: string): Promise<GapGroup[]>;
  getEvidence(classroomId: string, studentId: string, conceptId: string): Promise<AttemptEvent[]>;
  postTeacherEvent(classroomId: string, event: TeacherEvent): Promise<void>;
  getWeekly(classroomId: string, chapterId: string): Promise<WeeklyView>;
}
