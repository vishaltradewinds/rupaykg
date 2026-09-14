import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerStatutoryRoutes } from "./statutory-routes.js";

/**
 * The server keeps this compatibility registration point for BWG/statutory
 * functionality. The authoritative statutory module owns both BWG and EPR
 * applicability routes so the UI/API contract cannot drift into duplicate
 * Fastify registrations.
 */
export async function registerBwgRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  await registerStatutoryRoutes(app, pool);
}
