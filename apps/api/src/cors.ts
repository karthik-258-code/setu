import type { FastifyInstance } from "fastify";

const allowedMethods = new Set(["GET", "POST"]);
const allowedHeaders = new Set(["authorization", "content-type", "if-none-match"]);

/** Allows the configured web origins to call the API from a browser. */
export function registerCors(app: FastifyInstance, configuredOrigins: readonly string[]): void {
  const origins = new Set(configuredOrigins.map((origin) => origin.trim()).filter(Boolean));

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    const originAllowed = origin !== undefined && origins.has(origin);

    if (origin !== undefined) reply.header("Vary", "Origin");
    if (originAllowed) {
      reply.header("Access-Control-Allow-Origin", origin);
    }

    const preflightMethod = request.headers["access-control-request-method"];
    if (request.method !== "OPTIONS" || preflightMethod === undefined) return;

    reply.header("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
    if (!originAllowed) return reply.code(204).send();

    const method = preflightMethod.toUpperCase();
    if (!allowedMethods.has(method)) return reply.code(403).send();

    const requestedHeaders = (request.headers["access-control-request-headers"] ?? "")
      .split(",")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
    if (requestedHeaders.some((header) => !allowedHeaders.has(header))) {
      return reply.code(403).send();
    }

    reply
      .header("Access-Control-Allow-Methods", [...allowedMethods].join(", "))
      .header("Access-Control-Allow-Headers", requestedHeaders.join(", "))
      .header("Access-Control-Max-Age", "600");

    return reply.code(204).send();
  });
}
