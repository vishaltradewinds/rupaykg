import test from "node:test";
import assert from "node:assert/strict";
import { buildReportSnapshot, computeReportSnapshotHash, reportSnapshotToCsv, type ReportSnapshotInput } from "./reporting-engine.js";

const base: ReportSnapshotInput = {
  reportType: "SWM_2026",
  title: "Urban solid-waste material flow",
  organizationId: "org-123",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  geographyMode: "URBAN",
  methodologyCode: "SWM-MASS-BALANCE",
  methodologyVersion: "1.0.0",
  sourceRevision: "repo:abc123",
  generatedAt: "2026-11-14T08:00:00.000Z",
  rows: [{
    id: "flow-1",
    stakeholder: "GENERATOR",
    label: "Generator weighment",
    cells: [{
      key: "quantity",
      value: 1250,
      unit: "kg",
      quality: "OBSERVED",
      sourceRecordId: "activity-1",
      evidence: [{
        sourceRecordId: "activity-1",
        evidenceId: "evidence-1",
        evidenceHash: "sha256:abc",
        verificationId: "verification-1",
        verificationStatus: "VERIFIED",
      }],
    }],
  }],
};

test("complete evidence-backed snapshot is ready for review, never auto-approved", () => {
  const report = buildReportSnapshot(base);
  assert.equal(report.status, "READY_FOR_REVIEW");
  assert.equal(report.schemaVersion, "rupaykg.report.v1");
  assert.equal(report.issues.length, 0);
  assert.equal(report.snapshotHash.length, 64);
  assert.equal(report.sourceRecordIds[0], "activity-1");
  assert.equal(report.evidenceHashes[0], "sha256:abc");
});

test("snapshot hash is deterministic and changes when source data changes", () => {
  const first = buildReportSnapshot(base);
  const reordered = buildReportSnapshot({ ...base, rows: [...base.rows] });
  const changed = buildReportSnapshot({ ...base, rows: [{ ...base.rows[0]!, cells: [{ ...base.rows[0]!.cells[0]!, value: 1251 }] }] });
  assert.equal(first.snapshotHash, reordered.snapshotHash);
  assert.notEqual(first.snapshotHash, changed.snapshotHash);
});

test("missing and disputed values block the report without substituting zero", () => {
  const report = buildReportSnapshot({
    ...base,
    rows: [{ ...base.rows[0]!, cells: [{ ...base.rows[0]!.cells[0]!, value: null, quality: "MISSING" }] }],
  });
  assert.equal(report.status, "BLOCKED");
  assert.ok(report.issues.some(issue => issue.code === "MISSING_VALUE"));
  assert.equal(reportSnapshotToCsv(report).includes(",0,"), false);
});

test("estimated or unverified evidence remains a draft and is explicitly disclosed", () => {
  const report = buildReportSnapshot({
    ...base,
    rows: [{ ...base.rows[0]!, cells: [{ ...base.rows[0]!.cells[0]!, quality: "ESTIMATED", evidence: [{ sourceRecordId: "activity-1", evidenceId: "evidence-1", evidenceHash: "sha256:abc", verificationStatus: "PENDING" }] }] }],
  });
  assert.equal(report.status, "DRAFT");
  assert.ok(report.issues.some(issue => issue.code === "ESTIMATED_VALUE"));
  assert.ok(report.issues.some(issue => issue.code === "UNVERIFIED_EVIDENCE"));
});

test("CSV adapter quotes delimiters and preserves provenance columns", () => {
  const report = buildReportSnapshot({
    ...base,
    title: 'Material flow, "October"',
    rows: [{ ...base.rows[0]!, label: 'Generator, "North"', cells: base.rows[0]!.cells }],
  });
  const csv = reportSnapshotToCsv(report);
  assert.ok(csv.startsWith("report_type,report_title,organization_id"));
  assert.ok(csv.includes('"Material flow, ""October"""'));
  assert.ok(csv.includes("evidence-1"));
  assert.ok(csv.includes("sha256:abc"));
  assert.ok(csv.includes("verification-1"));
  const formulaSafe = reportSnapshotToCsv(buildReportSnapshot({ ...base, rows: [{ ...base.rows[0]!, cells: [{ ...base.rows[0]!.cells[0]!, value: "=HYPERLINK(\"https://example.com\")" }] }] }));
  assert.ok(formulaSafe.includes("\'=HYPERLINK"));
});


test("snapshot detaches and freezes nested input so its content cannot drift after hashing", () => {
  const mutableInput = structuredClone(base);
  const report = buildReportSnapshot(mutableInput);
  mutableInput.rows[0]!.cells[0]!.evidence![0]!.evidenceHash = "sha256:mutated-input";
  assert.equal(report.rows[0]!.cells[0]!.evidence![0]!.evidenceHash, "sha256:abc");
  assert.equal(Reflect.set(report.rows[0]!.cells[0]!.evidence![0]!, "evidenceHash", "sha256:mutated-output"), false);
  assert.equal(computeReportSnapshotHash(report), report.snapshotHash);
});

test("CSV preserves snapshot-level provenance and escapes minus-prefixed text but not numeric values", () => {
  const report = buildReportSnapshot({
    ...base,
    geographyScopeId: "geography-123",
    assumptions: ["Declared quantities are not independently measured."],
    rows: [{
      ...base.rows[0]!,
      cells: [
        { ...base.rows[0]!.cells[0]!, value: "-1+1" },
        { ...base.rows[0]!.cells[0]!, key: "negative_numeric", value: -10 },
        { ...base.rows[0]!.cells[0]!, key: "exact_negative_decimal", value: "-99999999999999.999999" },
      ],
    }],
  });
  const csv = reportSnapshotToCsv(report);
  assert.ok(csv.split("\r\n")[0]!.includes("source_revision"));
  assert.ok(csv.split("\r\n")[0]!.includes("generated_at"));
  assert.ok(csv.split("\r\n")[0]!.includes("assumptions"));
  assert.ok(csv.includes("geography-123"));
  assert.ok(csv.includes("repo:abc123"));
  assert.ok(csv.includes("2026-11-14T08:00:00.000Z"));
  assert.ok(csv.includes("Declared quantities are not independently measured."));
  assert.ok(csv.includes(",'-1+1,"));
  assert.ok(csv.includes(",-10,kg"));
  assert.ok(csv.includes(",-99999999999999.999999,kg"));
});

test("non-completed activity lifecycle blocks report readiness", () => {
  const report = buildReportSnapshot({
    ...base,
    rows: [{ ...base.rows[0]!, activityStatus: "DRAFT" }],
  });
  assert.equal(report.status, "BLOCKED");
  assert.ok(report.issues.some(issue => issue.code === "ACTIVITY_NOT_COMPLETED"));
});

test("CSV exports include activity lifecycle and complete issue details", () => {
  const report = buildReportSnapshot({
    ...base,
    rows: [{
      ...base.rows[0]!,
      activityStatus: "REJECTED",
      cells: [{ ...base.rows[0]!.cells[0]!, value: null, quality: "MISSING", evidence: [] }],
    }],
  });
  const csv = reportSnapshotToCsv(report);
  const header = csv.split("\r\n")[0]!;
  assert.ok(header.includes("activity_status"));
  assert.ok(header.includes("report_issues_json"));
  assert.ok(csv.includes(",REJECTED,"));
  assert.ok(csv.includes("ACTIVITY_NOT_COMPLETED"));
  assert.ok(csv.includes("Activity lifecycle status is REJECTED"));
  assert.ok(csv.includes("MISSING_VALUE"));
  assert.ok(csv.includes("MISSING_EVIDENCE"));
});

test("verified evidence status without a verification record reference stays a draft", () => {
  const report = buildReportSnapshot({
    ...base,
    rows: [{ ...base.rows[0]!, cells: [{ ...base.rows[0]!.cells[0]!, evidence: [{ sourceRecordId: "activity-1", evidenceId: "evidence-1", evidenceHash: "sha256:abc", verificationStatus: "VERIFIED" }] }] }],
  });
  assert.equal(report.status, "DRAFT");
  assert.ok(report.issues.some(issue => issue.code === "MISSING_VERIFICATION_REFERENCE"));
});

test("unavailable source revision cannot produce a review-ready report", () => {
  const report = buildReportSnapshot({ ...base, sourceRevision: "unavailable" });
  assert.equal(report.status, "DRAFT");
  assert.ok(report.issues.some(issue => issue.code === "SOURCE_REVISION_UNAVAILABLE"));
});

test("unmapped stakeholder attribution cannot produce a review-ready report", () => {
  const report = buildReportSnapshot({
    ...base,
    rows: [{ ...base.rows[0]!, stakeholder: "OTHER", stakeholderAttribution: "UNMAPPED" }],
  });
  assert.equal(report.status, "DRAFT");
  assert.ok(report.issues.some(issue => issue.code === "UNMAPPED_STAKEHOLDER"));
});

test("declared material quantities remain drafts until independently evidenced", () => {
  const report = buildReportSnapshot({
    ...base,
    rows: [{ ...base.rows[0]!, cells: [{ ...base.rows[0]!.cells[0]!, quality: "DECLARED", evidence: [] }] }],
  });
  assert.equal(report.status, "DRAFT");
  assert.ok(report.issues.some(issue => issue.code === "DECLARED_VALUE"));
  assert.ok(report.issues.some(issue => issue.code === "MISSING_EVIDENCE"));
});

test("rejects invalid periods, duplicate rows and duplicate cell keys", () => {
  assert.throws(() => buildReportSnapshot({ ...base, periodStart: "2026-02-31" }));
  assert.throws(() => buildReportSnapshot({ ...base, rows: [] }));
  assert.throws(() => buildReportSnapshot({ ...base, rows: [{ ...base.rows[0]!, cells: [{ ...base.rows[0]!.cells[0]!, value: Number.POSITIVE_INFINITY }] }] }));
  assert.throws(() => buildReportSnapshot({ ...base, periodStart: "2026-11-01", periodEnd: "2026-10-01" }));
  assert.throws(() => buildReportSnapshot({ ...base, rows: [base.rows[0]!, base.rows[0]!] }));
  assert.throws(() => buildReportSnapshot({ ...base, rows: [{ ...base.rows[0]!, cells: [base.rows[0]!.cells[0]!, base.rows[0]!.cells[0]!] }] }));
});
