import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOdkSubmission, type OdkApprovedSourceConfig, type OdkSubmissionMetadata } from "./normalize.js";

const config: OdkApprovedSourceConfig = {
  centralOrigin: "https://central.example.org/",
  projectId: 42,
  xmlFormId: "site_inspection_v1",
  formVersions: ["2026-01-01"],
  organizationId: "approved-org-001",
  siteId: "approved-site-001",
  activityId: "approved-activity-001"
};
const submission: OdkSubmissionMetadata = {
  instanceId: "uuid:synthetic-version-001",
  instanceIdOriginal: "uuid:synthetic-original-001",
  formVersion: "2026-01-01",
  submitterId: 7,
  submitterType: "user",
  createdAt: "2026-01-01T10:00:00Z",
  reviewState: "approved"
};
const pdf = Buffer.from("%PDF-1.7\nsynthetic fixture");

test("maps tenant/site/activity only from approved server configuration and always quarantines", () => {
  const result = normalizeOdkSubmission(config, submission, [{ metadata: { filename: "inspection.pdf", contentType: "application/pdf" }, bytes: pdf }]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.mappedOrganizationId, config.organizationId);
  assert.equal(result.value.mappedSiteId, config.siteId);
  assert.equal(result.value.mappedActivityId, config.activityId);
  assert.equal(result.value.centralReviewState, "approved");
  assert.equal(result.value.rupayKgState, "QUARANTINED");
});

test("rejects non-HTTPS, credentials, paths and query strings in configured Central origin", () => {
  for (const centralOrigin of ["http://central.example.org", "https://user:pass@central.example.org", "https://central.example.org/path", "https://central.example.org?x=1"]) {
    assert.deepEqual(normalizeOdkSubmission({ ...config, centralOrigin }, submission, []), { ok: false, code: "ODK_CONFIG_INVALID" });
  }
});

test("rejects unapproved form versions and unsafe submission identifiers", () => {
  assert.deepEqual(normalizeOdkSubmission(config, { ...submission, formVersion: "unknown" }, []), { ok: false, code: "ODK_FORM_VERSION_NOT_ALLOWED" });
  assert.deepEqual(normalizeOdkSubmission(config, { ...submission, instanceId: "../escape" }, []), { ok: false, code: "ODK_INSTANCE_ID_INVALID" });
});

test("rejects invalid timestamps and unsafe original-version identifiers", () => {
  assert.deepEqual(
    normalizeOdkSubmission(config, { ...submission, createdAt: "not-a-timestamp" }, []),
    { ok: false, code: "ODK_TIMESTAMP_INVALID" }
  );
  assert.deepEqual(
    normalizeOdkSubmission(config, { ...submission, updatedAt: "2026-99-99T25:61:00Z" }, []),
    { ok: false, code: "ODK_TIMESTAMP_INVALID" }
  );
  assert.deepEqual(
    normalizeOdkSubmission(config, { ...submission, instanceIdOriginal: "../other-submission" }, []),
    { ok: false, code: "ODK_ORIGINAL_INSTANCE_ID_INVALID" }
  );
});

test("rejects path traversal filenames, unsupported media, oversized and mismatched files", () => {
  const cases = [
    [{ filename: "../escape.pdf", contentType: "application/pdf" }, pdf, "ODK_ATTACHMENT_FILENAME_INVALID"],
    [{ filename: "x.exe", contentType: "application/x-msdownload" }, Buffer.from("MZ"), "ODK_ATTACHMENT_MEDIA_TYPE_UNSUPPORTED"],
    [{ filename: "bad.pdf", contentType: "application/pdf" }, Buffer.from("MZ"), "ODK_ATTACHMENT_SIGNATURE_MISMATCH"],
    [{ filename: "huge.pdf", contentType: "application/pdf" }, Buffer.alloc(5 * 1024 * 1024 + 1, 65), "ODK_ATTACHMENT_SIZE_INVALID"]
  ] as const;
  for (const [metadata, bytes, code] of cases) assert.deepEqual(normalizeOdkSubmission(config, submission, [{ metadata, bytes }]), { ok: false, code });
});

test("rejects duplicate attachment filenames and aggregate payloads over 10 MiB", () => {
  const one = { metadata: { filename: "same.pdf", contentType: "application/pdf" }, bytes: pdf };
  assert.deepEqual(normalizeOdkSubmission(config, submission, [one, one]), { ok: false, code: "ODK_ATTACHMENT_DUPLICATE_FILENAME" });
  // Three individually valid 4 MiB files exceed the 10 MiB aggregate cap; two would equal it.
  const large = Buffer.from("%PDF-" + "x".repeat(4 * 1024 * 1024 - 5));
  const tooLarge = normalizeOdkSubmission(config, submission, [
    { metadata: { filename: "a.pdf", contentType: "application/pdf" }, bytes: large },
    { metadata: { filename: "b.pdf", contentType: "application/pdf" }, bytes: large },
    { metadata: { filename: "c.pdf", contentType: "application/pdf" }, bytes: large }
  ]);
  assert.deepEqual(tooLarge, { ok: false, code: "ODK_SUBMISSION_ATTACHMENT_SIZE_LIMIT" });
});

test("source key and metadata digest are deterministic for the same source version", () => {
  const a = normalizeOdkSubmission(config, submission, [{ metadata: { filename: "inspection.pdf", contentType: "application/pdf" }, bytes: pdf }]);
  const b = normalizeOdkSubmission(config, submission, [{ metadata: { filename: "inspection.pdf", contentType: "application/pdf" }, bytes: pdf }]);
  assert.equal(a.ok && b.ok && a.value.sourceKey === b.value.sourceKey, true);
  assert.equal(a.ok && b.ok && a.value.sourceMetadataSha256 === b.value.sourceMetadataSha256, true);
});

test("different attachment bytes change the locally computed digest", () => {
  const a = normalizeOdkSubmission(config, submission, [{ metadata: { filename: "inspection.pdf", contentType: "application/pdf" }, bytes: pdf }]);
  const b = normalizeOdkSubmission(config, submission, [{ metadata: { filename: "inspection.pdf", contentType: "application/pdf" }, bytes: Buffer.from("%PDF-1.7\nchanged") }]);
  assert.equal(a.ok && b.ok && a.value.attachments[0]?.sha256 !== b.value.attachments[0]?.sha256, true);
});
