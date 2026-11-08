import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, type AuthContext } from "./auth.js";
import { withTenantTransaction } from "./tenant-db.js";
import { mapRupayKgMeasurementToSensorThings } from "./sensorthings-interoperability.js";

function requiredId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function requireAuth(request: any, reply: any, pool: Pool): Promise<AuthContext | null> {
  try {
    const auth = await authenticate(request, pool);
    if (!auth) {
      reply.code(401).send(bearerChallenge());
      return null;
    }
    return auth;
  } catch (error) {
    request.log.error(error);
    reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" });
    return null;
  }
}

export function registerSensorThingsRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/interoperability/sensorthings/measurements/:measurementId", async (request, reply) => {
    const auth = await requireAuth(request, reply, pool);
    if (!auth || !auth.activeOrganizationId) return;

    const measurementId = requiredId((request.params as { measurementId?: unknown }).measurementId);
    if (!measurementId) return reply.code(400).send({ error: "measurementId is required" });

    try {
      const mapped = await withTenantTransaction(pool, auth, async client => {
        const result = await client.query<{
          measurement_id: string;
          activity_id: string;
          organization_id: string;
          value: string;
          unit: string;
          method: string;
          source: string;
          measured_at: string;
          quality_status: string;
          measurement_metadata: Record<string, unknown>;
          activity_metadata: Record<string, unknown>;
        }>(
          `select
             m.id as measurement_id,
             a.id as activity_id,
             a.organization_id,
             m.value::text as value,
             m.unit,
             m.method,
             m.source,
             m.measured_at::text as measured_at,
             m.quality_status::text as quality_status,
             m.metadata as measurement_metadata,
             a.metadata as activity_metadata
           from measurements m
           join activities a on a.id = m.activity_id
           where m.id = $1 and a.organization_id = $2
           limit 1`,
          [measurementId, auth.activeOrganizationId],
        );

        const row = result.rows[0];
        if (!row) return null;

        const observedProperty = row.measurement_metadata?.observedProperty;
        const propertyId = observedProperty && typeof observedProperty === "object" && typeof (observedProperty as any).id === "string"
          ? (observedProperty as any).id
          : `method:${row.method}`;
        const propertyName = observedProperty && typeof observedProperty === "object" && typeof (observedProperty as any).name === "string"
          ? (observedProperty as any).name
          : row.method;
        const definition = observedProperty && typeof observedProperty === "object" && typeof (observedProperty as any).definition === "string"
          ? (observedProperty as any).definition
          : `urn:rupaykg:observed-property:${encodeURIComponent(row.method)}`;

        const location = row.activity_metadata?.location;
        const latitude = location && typeof location === "object" && typeof (location as any).latitude === "number" ? (location as any).latitude : undefined;
        const longitude = location && typeof location === "object" && typeof (location as any).longitude === "number" ? (location as any).longitude : undefined;

        return mapRupayKgMeasurementToSensorThings({
          deviceId: typeof row.measurement_metadata?.deviceId === "string" ? row.measurement_metadata.deviceId : row.source,
          measurementId: row.measurement_id,
          organizationId: row.organization_id,
          observedProperty: { id: propertyId, name: propertyName, definition },
          value: Number(row.value),
          unit: { name: row.unit, symbol: row.unit, definition: `urn:rupaykg:unit:${encodeURIComponent(row.unit)}` },
          phenomenonTime: row.measured_at,
          quality: row.quality_status,
          latitude,
          longitude,
          metadata: { method: row.method, source: row.source },
        });
      });

      if (!mapped) return reply.code(404).send({ error: "Measurement not found in active organization scope", code: "MEASUREMENT_NOT_FOUND" });
      return { source: "postgresql", syntheticData: false, interoperability: "ogc-sensorthings", data: mapped };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Authoritative measurement interoperability export unavailable", code: "SENSORTHINGS_EXPORT_UNAVAILABLE", syntheticData: false });
    }
  });
}
