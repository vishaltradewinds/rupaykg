/**
 * W3C PROV-compatible interoperability profile.
 *
 * This maps existing RupayKg authoritative records into PROV concepts without
 * replacing the existing evidence/MRV/calculation provenance subsystem.
 */

export type ProvEntity = {
  id: string;
  type: "Entity";
  label?: string;
  attributes?: Record<string, unknown>;
};

export type ProvActivity = {
  id: string;
  type: "Activity";
  label?: string;
  startTime?: string;
  endTime?: string;
  attributes?: Record<string, unknown>;
};

export type ProvAgent = {
  id: string;
  type: "Agent";
  label?: string;
  attributes?: Record<string, unknown>;
};

export type ProvRelation =
  | { type: "wasGeneratedBy"; entity: string; activity: string }
  | { type: "used"; activity: string; entity: string }
  | { type: "wasAssociatedWith"; activity: string; agent: string }
  | { type: "wasDerivedFrom"; generatedEntity: string; usedEntity: string }
  | { type: "wasAttributedTo"; entity: string; agent: string };

export type RupayKgProvDocument = {
  context: "https://www.w3.org/ns/prov";
  entity: ProvEntity[];
  activity: ProvActivity[];
  agent: ProvAgent[];
  relations: ProvRelation[];
};

export type RupayKgProvMappingInput = {
  evidenceId: string;
  activityId: string;
  observationId?: string;
  calculationId?: string;
  verificationId?: string;
  organizationId: string;
  identityId?: string;
  timestamps?: { startedAt?: string; endedAt?: string };
};

function id(prefix: string, value: string): string {
  return `rupaykg:${prefix}:${value}`;
}

export function mapRupayKgProvenance(input: RupayKgProvMappingInput): RupayKgProvDocument {
  const evidence = id("entity/evidence", input.evidenceId);
  const activity = id("activity", input.activityId);
  const organization = id("agent/organization", input.organizationId);

  const entity: ProvEntity[] = [
    { id: evidence, type: "Entity", label: "RupayKg evidence artifact" },
  ];
  const activityRecord: ProvActivity[] = [
    {
      id: activity,
      type: "Activity",
      label: "RupayKg activity",
      startTime: input.timestamps?.startedAt,
      endTime: input.timestamps?.endedAt,
    },
  ];
  const agent: ProvAgent[] = [
    { id: organization, type: "Agent", label: "RupayKg organization" },
  ];

  const relations: ProvRelation[] = [
    { type: "used", activity, entity: evidence },
    { type: "wasAssociatedWith", activity, agent: organization },
  ];

  if (input.observationId) {
    const observation = id("entity/observation", input.observationId);
    entity.push({ id: observation, type: "Entity", label: "RupayKg observation" });
    relations.push(
      { type: "wasGeneratedBy", entity: observation, activity },
      { type: "used", activity, entity: observation },
    );
  }

  if (input.calculationId) {
    const calculation = id("entity/calculation", input.calculationId);
    entity.push({ id: calculation, type: "Entity", label: "RupayKg carbon calculation" });
    relations.push(
      { type: "wasGeneratedBy", entity: calculation, activity },
      { type: "wasDerivedFrom", generatedEntity: calculation, usedEntity: evidence },
    );
  }

  if (input.verificationId) {
    const verification = id("activity/verification", input.verificationId);
    activityRecord.push({ id: verification, type: "Activity", label: "RupayKg verification" });
    relations.push(
      { type: "used", activity: verification, entity: evidence },
      { type: "wasAssociatedWith", activity: verification, agent: organization },
    );
    if (input.calculationId) {
      relations.push({
        type: "used",
        activity: verification,
        entity: id("entity/calculation", input.calculationId),
      });
    }
  }

  if (input.identityId) {
    const identity = id("agent/identity", input.identityId);
    agent.push({ id: identity, type: "Agent", label: "RupayKg authenticated identity" });
    relations.push({ type: "wasAssociatedWith", activity, agent: identity });
    relations.push({ type: "wasAttributedTo", entity: evidence, agent: identity });
  }

  return {
    context: "https://www.w3.org/ns/prov",
    entity,
    activity: activityRecord,
    agent,
    relations,
  };
}
