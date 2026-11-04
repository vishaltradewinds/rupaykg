import { createHash } from "node:crypto";

export const ODK_QUARANTINE_STATE = "QUARANTINED" as const;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_SUBMISSION_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "application/pdf", "text/csv", "text/plain", "application/json"]);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export interface OdkApprovedSourceConfig {
  centralOrigin: string;
  projectId: number;
  xmlFormId: string;
  formVersions: readonly string[];
  organizationId: string;
  siteId: string;
  activityId: string | null;
}

export interface OdkSubmissionMetadata {
  instanceId: string;
  instanceIdOriginal?: string;
  formVersion?: string;
  submitterId?: string | number;
  submitterType?: string;
  deviceId?: string;
  userAgent?: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  reviewState?: string;
}

export interface OdkAttachmentMetadata {
  filename: string;
  contentType: string;
}

export interface OdkQuarantinedAttachment {
  filename: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
}

export interface OdkQuarantineEnvelope {
  sourceSystem: "ODK_CENTRAL";
  sourceKey: string;
  sourceMetadataSha256: string;
  centralOrigin: string;
  projectId: number;
  xmlFormId: string;
  formVersion: string;
  originalInstanceId: string;
  versionInstanceId: string;
  mappedOrganizationId: string;
  mappedSiteId: string;
  mappedActivityId: string | null;
  centralReviewState: string | null;
  deletedAt: string | null;
  attachments: OdkQuarantinedAttachment[];
  rupayKgState: typeof ODK_QUARANTINE_STATE;
}

export type OdkNormalizeResult =
  | { ok: true; value: OdkQuarantineEnvelope }
  | { ok: false; code: string };

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function validIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= 200 && !CONTROL_CHARS.test(value) && !value.includes("/") && !value.includes("\\");
}

function validIsoDate(value: string | undefined | null): boolean {
  if (value == null) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const zone: string = match[8] ?? "";
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > (daysInMonth[month - 1] ?? 0)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (zone !== "Z") {
    const offset = /[+-](\d{2}):(\d{2})$/.exec(zone);
    if (!offset || Number(offset[1]) > 23 || Number(offset[2]) > 59) return false;
  }
  return true;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + canonicalJson(object[key])).join(",") + "}";
}

export function normalizeOdkSubmission(
  config: OdkApprovedSourceConfig,
  submission: OdkSubmissionMetadata,
  attachments: readonly { metadata: OdkAttachmentMetadata; bytes: Buffer }[]
): OdkNormalizeResult {
  const origin = normalizeOrigin(config.centralOrigin);
  if (!origin || !Number.isSafeInteger(config.projectId) || config.projectId <= 0) return { ok: false, code: "ODK_CONFIG_INVALID" };
  if (!validIdentifier(config.xmlFormId) || !config.organizationId || !config.siteId) return { ok: false, code: "ODK_MAPPING_INVALID" };
  if (!validIdentifier(submission.instanceId)) return { ok: false, code: "ODK_INSTANCE_ID_INVALID" };
  const originalId = submission.instanceIdOriginal ?? submission.instanceId;
  if (!validIdentifier(originalId)) return { ok: false, code: "ODK_ORIGINAL_INSTANCE_ID_INVALID" };
  if (!submission.formVersion || !config.formVersions.includes(submission.formVersion)) return { ok: false, code: "ODK_FORM_VERSION_NOT_ALLOWED" };
  if (!validIsoDate(submission.createdAt) || !validIsoDate(submission.updatedAt) || !validIsoDate(submission.deletedAt)) return { ok: false, code: "ODK_TIMESTAMP_INVALID" };
  if (attachments.length > 100) return { ok: false, code: "ODK_ATTACHMENT_COUNT_LIMIT" };

  const normalizedAttachments: OdkQuarantinedAttachment[] = [];
  const seenFilenames = new Set<string>();
  let totalAttachmentBytes = 0;
  for (const item of attachments) {
    const { filename, contentType } = item.metadata;
    if (!filename || filename.length > 180 || CONTROL_CHARS.test(filename) || filename === "." || filename === ".." || filename.includes("/") || filename.includes("\\") || filename !== filename.trim()) {
      return { ok: false, code: "ODK_ATTACHMENT_FILENAME_INVALID" };
    }
    if (seenFilenames.has(filename)) return { ok: false, code: "ODK_ATTACHMENT_DUPLICATE_FILENAME" };
    seenFilenames.add(filename);
    if (typeof contentType !== "string" || contentType.length > 200) return { ok: false, code: "ODK_ATTACHMENT_MEDIA_TYPE_UNSUPPORTED" };
    const mediaType = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) return { ok: false, code: "ODK_ATTACHMENT_MEDIA_TYPE_UNSUPPORTED" };
    if (!Buffer.isBuffer(item.bytes) || item.bytes.length === 0 || item.bytes.length > MAX_ATTACHMENT_BYTES) return { ok: false, code: "ODK_ATTACHMENT_SIZE_INVALID" };
    totalAttachmentBytes += item.bytes.length;
    if (totalAttachmentBytes > MAX_SUBMISSION_ATTACHMENT_BYTES) return { ok: false, code: "ODK_SUBMISSION_ATTACHMENT_SIZE_LIMIT" };
    if (mediaType === "image/jpeg" && !item.bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { ok: false, code: "ODK_ATTACHMENT_SIGNATURE_MISMATCH" };
    if (mediaType === "image/png" && !item.bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ok: false, code: "ODK_ATTACHMENT_SIGNATURE_MISMATCH" };
    if (mediaType === "application/pdf" && item.bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return { ok: false, code: "ODK_ATTACHMENT_SIGNATURE_MISMATCH" };
    if ((mediaType === "text/plain" || mediaType === "text/csv") && item.bytes.includes(0)) return { ok: false, code: "ODK_ATTACHMENT_SIGNATURE_MISMATCH" };
    if (mediaType === "application/json") {
      try { JSON.parse(item.bytes.toString("utf8")); } catch { return { ok: false, code: "ODK_ATTACHMENT_SIGNATURE_MISMATCH" }; }
    }
    normalizedAttachments.push({ filename, mediaType, sizeBytes: item.bytes.length, sha256: sha256(item.bytes) });
  }

  const versionId = submission.instanceId;
  const sourceKey = [origin, config.projectId, config.xmlFormId, originalId, versionId].join("/");
  const sourceMetadata = {
    sourceKey,
    formVersion: submission.formVersion,
    submitterId: submission.submitterId ?? null,
    submitterType: submission.submitterType ?? null,
    deviceId: submission.deviceId ?? null,
    userAgent: submission.userAgent ?? null,
    createdAt: submission.createdAt ?? null,
    updatedAt: submission.updatedAt ?? null,
    deletedAt: submission.deletedAt ?? null,
    attachments: normalizedAttachments
  };
  return {
    ok: true,
    value: {
      sourceSystem: "ODK_CENTRAL",
      sourceKey,
      sourceMetadataSha256: sha256(Buffer.from(canonicalJson(sourceMetadata))),
      centralOrigin: origin,
      projectId: config.projectId,
      xmlFormId: config.xmlFormId,
      formVersion: submission.formVersion,
      originalInstanceId: originalId,
      versionInstanceId: versionId,
      mappedOrganizationId: config.organizationId,
      mappedSiteId: config.siteId,
      mappedActivityId: config.activityId,
      centralReviewState: submission.reviewState ?? null,
      deletedAt: submission.deletedAt ?? null,
      attachments: normalizedAttachments,
      rupayKgState: ODK_QUARANTINE_STATE
    }
  };
}
