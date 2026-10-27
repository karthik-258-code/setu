import type { FastifyPluginAsync } from "fastify";
import { healthResponseSchema, routes } from "@setu/shared";
import pkg from "../../package.json";

/** Liveness only: must never touch the database. */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(routes.health, async () =>
    healthResponseSchema.parse({ status: "ok", version: pkg.version }),
  );
};
