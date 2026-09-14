import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerEprReturnRoutes } from "./epr-return-routes.js";

/**
 * Compatibility registration point retained for the server's existing BWG
 * registration order. Statutory EPR return routes are registered here so the
 * application exposes the DB-backed return lifecycle without duplicating the
 * broader statutory route registration in the MRV module.
 */
export async function registerBwgRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  await registerEprReturnRoutes(app, pool);
}
