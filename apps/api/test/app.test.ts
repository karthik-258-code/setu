import { afterAll, describe, expect, it } from "vitest";
import { errorResponseSchema, healthResponseSchema } from "@setu/shared";
import { buildApp } from "../src/app";

const app = buildApp();
afterAll(() => app.close());

describe("GET /health", () => {
  it("returns 200 with status ok and a version that the shared DTO accepts", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = healthResponseSchema.parse(res.json());
    expect(body.status).toBe("ok");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("error handling", () => {
  it("returns 404 in the shared error shape for an unknown route", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    const body = errorResponseSchema.parse(res.json());
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns the shared error shape for a wrong method on a known route", async () => {
    const res = await app.inject({ method: "POST", url: "/health" });
    expect(res.statusCode).toBe(404);
    expect(errorResponseSchema.safeParse(res.json()).success).toBe(true);
  });
});
