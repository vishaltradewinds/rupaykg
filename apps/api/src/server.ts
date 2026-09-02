import Fastify from "fastify";
import cors from "@fastify/cors";
import { Pool } from "pg";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 10 })
  : null;

app.get("/health", async (_request, reply) => {
  let database: "AVAILABLE" | "UNAVAILABLE" = "UNAVAILABLE";

  if (pool) {
    try {
      await pool.query("select 1");
      database = "AVAILABLE";
    } catch {
      database = "UNAVAILABLE";
    }
  }

  const healthy = database === "AVAILABLE";
  return reply.code(healthy ? 200 : 503).send({
    status: healthy ? "READY" : "DEGRADED",
    database,
    syntheticData: false,
  });
});

app.get("/api/v1/status", async () => ({
  service: "rupaykg-api",
  version: "0.1.0",
  sourceOfTruth: "postgresql",
  syntheticData: false,
}));

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
