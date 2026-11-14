import { createHash } from "node:crypto";

export type ReportStatus = "BLOCKED" | "READY_FOR_REVIEW" | "DRAFT";
export type ReportValue = string | number | boolean | null;
export type ReportQuality = "OBSERVED" | "DECLARED" | "ESTIMATED" | "DISPUTED" | "MISSING";
export type ReportEvidence = {
  sourceRecordId: string;
  evidenceId?: string | null;
  evidenceHash?: string | null;
  verificationId?: string | null;
  verificationStatus?: string | null;
};
export type ReportCell = {
  key: string;
  value: ReportValue;
  unit?: string | null;
  quality: ReportQuality;
  sourceRecordId: string;
  evidence?: ReportEvidence[];
  note?: string | null;
};
export type ReportRow = {
  id: string;
  stakeholder: "GENERATOR" | "AGGREGATOR" | "TRANSPORTER" | "RECYCLER" | "PROCESSOR" | "ULB" | "GRAM_PANCHAYAT" | "BWG" | "OTHER";
  label: string;
  cells: ReportCell[];
};
export type ReportSnapshotInput = {
  reportType: string;
  title: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  geographyMode: "URBAN" | "RURAL" | "CROSS_CONTEXT";
  methodologyCode: string;
  methodologyVersion: string;
  sourceRevision: string;
  generatedAt: string;
  rows: ReportRow[];
  assumptions?: string[];
};
export type ReportIssue = {
  code: "MISSING_VALUE" | "DECLARED_VALUE" | "ESTIMATED_VALUE" | "DISPUTED_VALUE" | "MISSING_EVIDENCE" | "UNVERIFIED_EVIDENCE" | "UNMAPPED_STAKEHOLDER";
  rowId: string;
  cellKey: string;
  detail: string;
};
export type ReportSnapshot = ReportSnapshotInput & {
  schemaVersion: "rupaykg.report.v1";
  status: ReportStatus;
  issues: ReportIssue[];
  sourceRecordIds: string[];
  evidenceHashes: string[];
  snapshotHash: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}

/** Builds an immutable, deterministic report snapshot; it never upgrades evidence or assurance states. */
export function buildReportSnapshot(input: ReportSnapshotInput): ReportSnapshot {
  if (!input.reportType.trim() || !input.title.trim() || !input.organizationId.trim()) throw new Error("Report type, title and organization are required");
  if (!validDate(input.periodStart) || !validDate(input.periodEnd) || input.periodStart > input.periodEnd) throw new Error("A valid, ordered reporting period is required");
  if (!input.methodologyCode.trim() || !input.methodologyVersion.trim() || !input.sourceRevision.trim()) throw new Error("Methodology version and source revision are required");
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new Error("generatedAt must be a valid timestamp");
  if (!input.rows.length) throw new Error("A report must contain at least one source row");
  const rowIds = new Set<string>();
  const issues: ReportIssue[] = [];
  const sourceRecordIds = new Set<string>();
  const evidenceHashes = new Set<string>();
  for (const row of input.rows) {
    if (!row.id.trim() || rowIds.has(row.id)) throw new Error("Report row IDs must be non-empty and unique");
    rowIds.add(row.id);
    const keys = new Set<string>();
    for (const cell of row.cells) {
      if (!cell.key.trim() || keys.has(cell.key)) throw new Error(`Cell keys must be unique within row ${row.id}`);
      keys.add(cell.key);
      if (!cell.sourceRecordId.trim()) throw new Error(`Source record ID is required for ${row.id}.${cell.key}`);
      if (typeof cell.value === "number" && !Number.isFinite(cell.value)) throw new Error(`Report value must be finite for ${row.id}.${cell.key}`);
      sourceRecordIds.add(cell.sourceRecordId);
      if (cell.quality === "MISSING" || cell.value === null) issues.push({ code: "MISSING_VALUE", rowId: row.id, cellKey: cell.key, detail: "Value is missing; do not infer or silently substitute zero." });
      if (cell.quality === "DECLARED") issues.push({ code: "DECLARED_VALUE", rowId: row.id, cellKey: cell.key, detail: "Value is a stakeholder-declared quantity; it is not treated as independently measured." });
      if (cell.quality === "ESTIMATED") issues.push({ code: "ESTIMATED_VALUE", rowId: row.id, cellKey: cell.key, detail: "Value is estimated and must remain visibly identified." });
      if (cell.quality === "DISPUTED") issues.push({ code: "DISPUTED_VALUE", rowId: row.id, cellKey: cell.key, detail: "Value is disputed and requires resolution." });
      if (cell.evidence?.length) {
        for (const evidence of cell.evidence) {
          if (evidence.sourceRecordId !== cell.sourceRecordId) throw new Error("Evidence source record must match its report cell");
          if (!evidence.evidenceId || !evidence.evidenceHash) issues.push({ code: "MISSING_EVIDENCE", rowId: row.id, cellKey: cell.key, detail: "Evidence reference or content hash is missing." });
          else evidenceHashes.add(evidence.evidenceHash);
          if (!evidence.verificationStatus || !["VERIFIED", "APPROVED", "ASSURED"].includes(evidence.verificationStatus)) {
            issues.push({ code: "UNVERIFIED_EVIDENCE", rowId: row.id, cellKey: cell.key, detail: `Evidence status is ${evidence.verificationStatus}; it is not treated as verified.` });
          }
        }
      } else {
        issues.push({ code: "MISSING_EVIDENCE", rowId: row.id, cellKey: cell.key, detail: "No evidence reference is attached to this value." });
      }
    }
  }
  const blocking = issues.some(issue => ["MISSING_VALUE", "DISPUTED_VALUE"].includes(issue.code));
  const status: ReportStatus = blocking ? "BLOCKED" : issues.length ? "DRAFT" : "READY_FOR_REVIEW";
  const base = {
    ...input,
    schemaVersion: "rupaykg.report.v1" as const,
    status,
    issues,
    sourceRecordIds: [...sourceRecordIds].sort(),
    evidenceHashes: [...evidenceHashes].sort(),
  };
  return { ...base, snapshotHash: createHash("sha256").update(canonical(base)).digest("hex") };
}

function csv(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const text = typeof value === "string" && /^[=+@\t\r]/.test(raw) ? "'" + raw : raw;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** A lossless, machine-readable long-form CSV adapter for a report snapshot. */
export function reportSnapshotToCsv(snapshot: ReportSnapshot): string {
  const header = ["report_type", "report_title", "organization_id", "period_start", "period_end", "geography_mode", "methodology_code", "methodology_version", "snapshot_hash", "report_status", "row_id", "stakeholder", "stakeholder_attribution", "row_label", "field", "value", "unit", "quality", "source_record_id", "evidence_ids", "evidence_hashes", "verification_ids", "verification_status", "note"];
  const rows = snapshot.rows.flatMap(row => row.cells.map(cell => [
    snapshot.reportType, snapshot.title, snapshot.organizationId, snapshot.periodStart, snapshot.periodEnd, snapshot.geographyMode,
    snapshot.methodologyCode, snapshot.methodologyVersion, snapshot.snapshotHash, snapshot.status, row.id, row.stakeholder,
    row.label, cell.key, cell.value, cell.unit ?? "", cell.quality, cell.sourceRecordId,
    (cell.evidence ?? []).map(item => item.evidenceId ?? "").join(";"),
    (cell.evidence ?? []).map(item => item.evidenceHash ?? "").join(";"),
    (cell.evidence ?? []).map(item => item.verificationId ?? "").join(";"),
    (cell.evidence ?? []).map(item => item.verificationStatus ?? "NOT_REPORTED").join(";"), cell.note ?? "",
  ]));
  return [header, ...rows].map(row => row.map(csv).join(",")).join("\r\n") + "\r\n";
}
