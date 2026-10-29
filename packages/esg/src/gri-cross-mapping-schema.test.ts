import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as Ajv2020Module from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";

const Ajv2020 = ((Ajv2020Module as unknown as { default?: unknown }).default ?? Ajv2020Module) as new (options?: object) => { compile: (schema: object) => ((data: unknown) => boolean) & { errors?: Array<{ keyword?: string }> } };
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule) as (ajv: InstanceType<typeof Ajv2020>) => void;

const schemaUrl = new URL("../../../schemas/gri-cross-mapping.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const validRecord = {
  schema_version: "1.0.0",
  mapping_id: "GRI.WASTE.306.001",
  status: "draft",
  source_requirement: {
    framework: "INDIA_STATUTORY",
    instrument_id: "SWM-RULE-EXAMPLE",
    requirement_id: "RULE-EXAMPLE-1",
    title: "Example statutory waste requirement",
    version: "2026-01",
    source_url: "https://moef.gov.in/",
    effective_from: "2026-01-01",
    effective_to: null,
    authority_type: "regulation",
    official_source_verified_at: "2026-10-29T10:00:00Z"
  },
  target_disclosure: {
    framework: "GRI",
    standard_id: "GRI 306",
    disclosure_id: "306-3",
    title: "Waste generated",
    version: "GRI 306: Waste 2020",
    effective_from: "2020-01-01",
    materiality_dependent: true
  },
  relationship: "supports",
  rationale: "The source evidence may support this disclosure but is not equivalent to it.",
  limitations: ["Requires reporting-boundary and materiality review."],
  applicability: {
    determination: "applicable",
    basis: "Documented entity and reporting-period assessment.",
    entity_types: ["producer"],
    thresholds: [],
    reporting_period: "FY2026-27",
    reviewed_by: null,
    reviewed_at: null
  },
  metrics: [{
    metric_id: "waste_generated",
    unit: "tonne",
    method: "weighbridge measurement",
    boundary: "facility",
    disaggregation: ["waste_category"],
    calculation_version: "1.0",
    uncertainty: null
  }],
  evidence: {
    required: true,
    items: [{
      evidence_id: "EV-001",
      evidence_type: "weighbridge_ticket",
      source_system: "RupayKg-MRV",
      period: "FY2026-27",
      uri_or_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      captured_at: "2026-10-29T10:00:00Z",
      integrity_status: "validated"
    }],
    lineage_status: "complete"
  },
  controls: {
    validation_rules: ["Evidence must be independently reviewable."],
    double_counting_check: "not_run",
    assurance_status: "not_assured",
    compliance_conclusion: "not_assessed",
    credit_eligibility_conclusion: "not_assessed"
  },
  governance: {
    owner_role: "ESG_DATA_OWNER",
    approver_role: "INDEPENDENT_REVIEWER",
    created_at: "2026-10-29T10:00:00Z",
    change_log_ref: "CHANGE-001",
    supersedes_mapping_id: null
  }
};

test("GRI cross-mapping schema accepts a structurally valid versioned record", () => {
  assert.equal(validate(validRecord), true, JSON.stringify(validate.errors));
});

test("GRI cross-mapping schema rejects missing required fields and unknown properties", () => {
  assert.equal(validate({ schema_version: "1.0.0" }), false);
  assert.ok((validate.errors ?? []).length > 0);

  assert.equal(validate({ ...validRecord, unreviewed_override: true }), false);
  assert.ok((validate.errors ?? []).some((error: { keyword?: string }) => error.keyword === "additionalProperties"));
});

test("GRI cross-mapping schema rejects malformed source URL and impossible effective date", () => {
  const invalidUrl = {
    ...validRecord,
    source_requirement: { ...validRecord.source_requirement, source_url: "javascript:alert(1)" }
  };
  assert.equal(validate(invalidUrl), false);

  const insecureUrl = {
    ...validRecord,
    source_requirement: { ...validRecord.source_requirement, source_url: "http://moef.gov.in/" }
  };
  assert.equal(validate(insecureUrl), false);

  const invalidDate = {
    ...validRecord,
    source_requirement: { ...validRecord.source_requirement, effective_from: "2026-02-30" }
  };
  assert.equal(validate(invalidDate), false);
});
