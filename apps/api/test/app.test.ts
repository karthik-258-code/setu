import { afterAll, describe, expect, it } from "vitest";
import { errorResponseSchema, healthResponseSchema } from "@setu/shared";
import { buildApp } from "../src/app";

const app = buildApp();
const corsApp = buildApp({}, undefined, ["https://setu.onrender.com"]);
afterAll(() => app.close());
afterAll(() => corsApp.close());

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

describe("browser API access", () => {
  it("adds the allowed website to normal API responses", async () => {
    const response = await corsApp.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://setu.onrender.com" },
    });

    expect(response.headers["access-control-allow-origin"]).toBe("https://setu.onrender.com");
    expect(response.headers.vary).toContain("Origin");
  });

  it("allows the configured website and its JSON authorization preflight", async () => {
    const response = await corsApp.inject({
      method: "OPTIONS",
      url: "/auth/teacher/login",
      headers: {
        origin: "https://setu.onrender.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://setu.onrender.com");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
    expect(response.headers["access-control-allow-headers"]).toContain("authorization");
  });

  it("does not grant browser access to an unconfigured website", async () => {
    const response = await corsApp.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://untrusted.example" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
