import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, type AuthContext } from "./auth.js";
import { acceptExternalIntegrationMessage } from "./external-integration-mediator.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };

async function authFor(request: any, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; }
  try {
    const auth = await authenticate(request, pool);
    if (!auth) { reply.code(401).send(bearerChallenge()); return null; }
    return auth;
  } catch (error) {
    request.log.error(error);
    reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" });
    return null;
  }
}

export async function registerExternalIntegrationRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/integrations/messages", async (request, reply) => {
    const auth = await authFor(request, reply, pool);
    if (!auth || !pool) return;

    try {
      const result = await acceptExternalIntegrationMessage(pool, auth, request.body as any);
      return reply.code(result.duplicate ? 200 : 202).send({
        source: "postgresql",
        syntheticData: false,
        authoritativeMutation: false,
        ...result,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "ORG_FORBIDDEN") return reply.code(403).send({ error: (error as Error).message, code });
      if (code === "INVALID_INTEGRATION_ENVELOPE" || code === "UNSUPPORTED_CONTRACT_VERSION" || code === "INVALID_DIRECTION" || code === "INVALID_MESSAGE_KIND" || code === "INVALID_OCCURRED_AT" || code === "INVALID_PAYLOAD") {
        return reply.code(400).send({ error: (error as Error).message, code });
      }
      request.log.error(error);
      return reply.code(503).send({ error: "External integration mediator unavailable", code: "INTEGRATION_MEDIATOR_UNAVAILABLE", syntheticData: false });
    }
  });
}
