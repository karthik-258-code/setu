import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { errorResponseSchema, type ErrorResponse } from "@setu/shared";
import type { ApiDeps } from "./deps";
import { ApiError } from "./errors";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { studentRoutes } from "./routes/student";
import { teacherRoutes } from "./routes/teacher";

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  429: "TOO_MANY_REQUESTS",
};

function errorBody(code: string, message: string): ErrorResponse {
  return errorResponseSchema.parse({ error: { code, message } });
}

/**
 * Builds the Fastify instance without listening, so tests can use `app.inject`. Without `deps`
 * only `/health` is served; with them, every route of ARCHITECTURE 8.1.
 */
export function buildApp(options: FastifyServerOptions = {}, deps?: ApiDeps): FastifyInstance {
  const app = Fastify(options);

  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send(errorBody("NOT_FOUND", `Route ${request.method} ${request.url} not found`)),
  );

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if ((error as unknown) instanceof ApiError) {
      const apiError = error as unknown as ApiError;
      return reply.code(apiError.statusCode).send(errorBody(apiError.code, apiError.message));
    }
    const status =
      error.statusCode !== undefined && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(500).send(errorBody("INTERNAL_ERROR", "Internal server error"));
    }
    return reply.code(status).send(errorBody(STATUS_CODES[status] ?? "BAD_REQUEST", error.message));
  });

  app.register(healthRoutes);
  if (deps) {
    app.register(authRoutes, { deps });
    app.register(studentRoutes, { deps });
    app.register(teacherRoutes, { deps });
  }

  return app;
}
