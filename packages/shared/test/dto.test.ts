import { describe, expect, it } from "vitest";
import {
  MAX_SYNC_EVENTS,
  errorResponseSchema,
  gapGroupSchema,
  gapMapSchema,
  meStateResponseSchema,
  packResponseSchema,
  paths,
  routes,
  studentLoginRequestSchema,
  syncRequestSchema,
  syncResponseSchema,
  weeklyViewSchema,
} from "../src/index";
import { eventFixtures, stateFixture } from "./fixtures";

function batch(size: number) {
  return {
    deviceId: "dev-1",
    events: Array.from({ length: size }, (_, i) => ({
      ...eventFixtures.attempt,
      id: `evt-${i}`,
    })),
  };
}

describe("syncRequestSchema", () => {
  it("accepts a batch of exactly 200 events", () => {
    expect(MAX_SYNC_EVENTS).toBe(200);
    expect(syncRequestSchema.safeParse(batch(200)).success).toBe(true);
  });

  it("rejects a batch of 201 events", () => {
    expect(syncRequestSchema.safeParse(batch(201)).success).toBe(false);
  });

  it("rejects a batch containing an unknown event type", () => {
    const request = batch(1);
    request.events.push({ ...eventFixtures.attempt, id: "evt-x", type: "teleport" } as never);
    expect(syncRequestSchema.safeParse(request).success).toBe(false);
  });

  it("requires a device id", () => {
    expect(syncRequestSchema.safeParse({ events: [] }).success).toBe(false);
  });
});

describe("syncResponseSchema", () => {
  it("parses accepted ids, rejected reasons and server time", () => {
    const response = {
      accepted: ["a"],
      rejected: [{ id: "b", reason: "unknown studentId" }],
      serverTime: "2026-10-27T10:00:00.000Z",
    };
    expect(syncResponseSchema.parse(response)).toEqual(response);
  });
});

describe("errorResponseSchema", () => {
  it("parses the shared error shape", () => {
    const body = { error: { code: "VALIDATION_ERROR", message: "events: too many" } };
    expect(errorResponseSchema.parse(body)).toEqual(body);
  });

  it("rejects a bare string error", () => {
    expect(errorResponseSchema.safeParse({ error: "nope" }).success).toBe(false);
  });
});

describe("response schemas that mirror engine types", () => {
  it("round-trips a StudentState", () => {
    expect(meStateResponseSchema.parse(JSON.parse(JSON.stringify(stateFixture)))).toEqual(
      stateFixture,
    );
  });

  it("round-trips a GapMap with an untouched cell", () => {
    const gapMap = {
      chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
      columns: { prerequisites: ["M6.FRAC.EQUIV"], chapter: ["M8.LEQ.ONE_SIDE"] },
      rows: [
        {
          studentId: "stu-anjali",
          displayName: "Anjali",
          rollNo: "12",
          mastery: { "M6.FRAC.EQUIV": 0.95, "M8.LEQ.ONE_SIDE": null },
          readinessDone: true,
          rootCauseGap: null,
        },
      ],
    };
    expect(gapMapSchema.parse(gapMap)).toEqual(gapMap);
  });

  it("round-trips a GapGroup", () => {
    const group = {
      id: "gap:M6.FRAC.ADD_SUB_UNLIKE",
      kind: "gap",
      conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
      dominantMisconception: "F-ADD-DENOM",
      studentIds: ["stu-ravi"],
      suggestedQuestionIds: ["M6.FRAC.ADD_SUB_UNLIKE.Q01"],
      suggestedAction: "small_group",
    };
    expect(gapGroupSchema.parse(group)).toEqual(group);
  });

  it("round-trips a WeeklyView", () => {
    const weekly = {
      chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
      from: "2026-10-20T00:00:00.000Z",
      to: "2026-10-27T00:00:00.000Z",
      moved: [{ studentId: "stu-ravi", fromGroupId: "gap:A", toGroupId: "ready" }],
      blockingConcepts: [{ conceptId: "M6.FRAC.ADD_SUB_UNLIKE", studentCount: 4 }],
      recheckResults: [
        {
          conceptId: "M6.FRAC.ADD_SUB_UNLIKE",
          taughtAt: "2026-10-22T00:00:00.000Z",
          passed: 3,
          failed: 1,
        },
      ],
    };
    expect(weeklyViewSchema.parse(weekly)).toEqual(weekly);
  });
});

describe("studentLoginRequestSchema", () => {
  it("requires a 4-digit PIN", () => {
    const ok = { classroomCode: "ABC123", rollNo: "12", pin: "0420" };
    expect(studentLoginRequestSchema.safeParse(ok).success).toBe(true);
    expect(studentLoginRequestSchema.safeParse({ ...ok, pin: "42" }).success).toBe(false);
  });
});

describe("paths", () => {
  it("builds concrete URLs and encodes ids", () => {
    expect(paths.pack("CH.M8.LINEAR_EQ_ONE_VAR")).toBe("/packs/CH.M8.LINEAR_EQ_ONE_VAR");
    expect(paths.gapMap("c 1", "CH.M8.X")).toBe("/classrooms/c%201/gapmap?chapterId=CH.M8.X");
    expect(paths.evidence("c1", "s1", "M6.FRAC.EQUIV")).toBe(
      "/classrooms/c1/students/s1/evidence?conceptId=M6.FRAC.EQUIV",
    );
    expect(paths.events("c1")).toBe("/classrooms/c1/events");
  });

  it("exposes a route pattern for every path builder", () => {
    expect(Object.keys(routes).sort()).toEqual(Object.keys(paths).sort());
  });
});

describe("packResponseSchema", () => {
  const pack = {
    packVersion: "0.1.0",
    builtAt: "2026-10-27T08:00:00.000Z",
    chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
    graph: {
      concepts: {
        "M8.LEQ.ONE_SIDE": {
          id: "M8.LEQ.ONE_SIDE",
          classLevel: 8,
          subject: "math",
          chapterId: "CH.M8.LINEAR_EQ_ONE_VAR",
          title: { en: "Equations with the variable on one side", te: "ఒక వైపు చరరాశి" },
          prerequisites: [],
          boardTags: ["NCERT", "TS_SCERT"],
        },
      },
      chapters: {
        "CH.M8.LINEAR_EQ_ONE_VAR": {
          id: "CH.M8.LINEAR_EQ_ONE_VAR",
          classLevel: 8,
          subject: "math",
          title: { en: "Linear Equations in One Variable" },
          conceptIds: ["M8.LEQ.ONE_SIDE"],
          boardTags: ["NCERT"],
          depth: "full",
        },
      },
      topoOrder: ["M8.LEQ.ONE_SIDE"],
    },
    questions: [
      {
        id: "M8.LEQ.ONE_SIDE.Q01",
        conceptId: "M8.LEQ.ONE_SIDE",
        difficulty: 1,
        stem: { en: "Solve x + 3 = 7" },
        boardTags: ["NCERT"],
        reviewStatus: "draft",
        type: "numeric",
        answer: 4,
      },
    ],
    resources: [],
    misconceptions: {},
    reasonTemplates: { R5_LEARN: { en: "Before {chapter}, we are practising {concept}." } },
  };

  it("round-trips a pack and validates its questions deeply", () => {
    expect(packResponseSchema.parse(pack)).toEqual(pack);
    const broken = { ...pack, questions: [{ ...pack.questions[0], difficulty: 4 }] };
    expect(packResponseSchema.safeParse(broken).success).toBe(false);
  });
});
