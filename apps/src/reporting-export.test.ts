import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { buildReportSnapshot, type ReportSnapshotInput } from "./reporting-engine.js";
import { createReportPdf, createReportXlsx } from "./reporting-export.js";

const base: ReportSnapshotInput = {
  reportType: "CPCB_SWMP_2026",
  title: "Urban solid-waste report - नमस्ते भारत",
  organizationId: "org-123",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  geographyMode: "URBAN",
  methodologyCode: "SWM-REPORT-TEMPLATE",
  methodologyVersion: "1.0.0",
  sourceRevision: "repo:abc123",
  generatedAt: "2026-11-14T08:00:00.000Z",
  assumptions: ["Declared quantities are not independently measured."],
  rows: [{
    id: "activity-1",
    stakeholder: "AGGREGATOR",
    stakeholderAttribution: "VERIFIED",
    label: "कचरा संग्रहण",
    cells: [{
      key: "quantity",
      value: 1250,
      unit: "kg",
      quality: "OBSERVED",
      sourceRecordId: "activity-1",
      note: "=HYPERLINK(\"https://example.invalid\",\"open\")",
      evidence: [{
        sourceRecordId: "activity-1",
        evidenceId: "evidence-1",
        evidenceHash: "a".repeat(64),
        verificationId: "verification-1",
        verificationStatus: "VERIFIED",
      }],
    }],
  }],
};

test("PDF export embeds the bundled Unicode font and immutable snapshot metadata", async () => {
  const snapshot = buildReportSnapshot(base);
  const pdf = await createReportPdf(snapshot);
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdf.length > 5000);
  const raw = pdf.toString("latin1");
  assert.ok(raw.includes("/FontFile2"), "the Unicode-capable font should be embedded");
  assert.ok(raw.includes("/ToUnicode"), "the PDF should include a Unicode character map");
  assert.ok(raw.includes(snapshot.snapshotHash), "the immutable snapshot hash should be present in PDF metadata");
});

test("XLSX export is an OOXML workbook with provenance, quality and formula-safe inline strings", async () => {
  const snapshot = buildReportSnapshot(base);
  const xlsx = await createReportXlsx(snapshot);
  assert.equal(xlsx.subarray(0, 2).toString("ascii"), "PK");
  const files = unzipSync(xlsx);
  for (const path of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
    "xl/worksheets/sheet2.xml",
    "xl/worksheets/sheet3.xml",
    "xl/worksheets/sheet4.xml",
  ]) assert.ok(files[path], "missing OOXML part " + path);
  const workbook = strFromU8(files["xl/workbook.xml"]!);
  assert.match(workbook, /Summary/);
  assert.match(workbook, /Report Rows/);
  assert.match(workbook, /Provenance/);
  assert.match(workbook, /Data Quality/);
  const rows = strFromU8(files["xl/worksheets/sheet2.xml"]!);
  const provenance = strFromU8(files["xl/worksheets/sheet3.xml"]!);
  const quality = strFromU8(files["xl/worksheets/sheet4.xml"]!);
  assert.match(rows, /AGGREGATOR/);
  assert.match(rows, /VERIFIED/);
  assert.match(rows, /&apos;=HYPERLINK/);
  assert.doesNotMatch(rows, /<f[ >]/i);
  assert.match(provenance, /evidence-1/);
  assert.match(provenance, new RegExp("a".repeat(64)));
  assert.match(quality, /Declared quantities are not independently measured/);
});
