import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { baselineAttestationConfig, signBaselineAttestation, verifyBaselineAttestation } from "./bm-wa03001-baseline-attestation.js";

test("BM WA03.001 baseline VC-JWT is Ed25519 signed, scoped, time-bounded and tamper-evident", () => {
  const pair = generateKeyPairSync("ed25519");
  const privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const config = { issuerDid: "did:web:rupaykg.example", keyId: "did:web:rupaykg.example#baseline-ed25519-1", privateKeyPem };
  const now = Math.floor(Date.now() / 1000);
  const signed = signBaselineAttestation({
    issuerDid: config.issuerDid, keyId: config.keyId, baselineRecordId: "8c2b9a11-0f35-4a44-9a72-0fbb1b91a001",
    activityId: "8c2b9a11-0f35-4a44-9a72-0fbb1b91a002", organizationId: "8c2b9a11-0f35-4a44-9a72-0fbb1b91a003",
    methodologyCode: "BM WA03.001", methodologyVersion: "1.0", baselineFch4Tch4: 1.25,
    baselinePeriod: "2025", baselineRecordSha256: "a".repeat(64), baselineEvidenceIds: ["evidence-b", "evidence-a"],
    approvedByIdentityId: "8c2b9a11-0f35-4a44-9a72-0fbb1b91a004", approvedAt: new Date(now * 1000).toISOString(),
    issuedAt: now, expiresAt: now + 90 * 86400,
  }, config);
  assert.equal(verifyBaselineAttestation(signed.jwt, pair.publicKey, config.issuerDid, config.keyId, now), true);
  assert.equal(signed.sha256.length, 64);
  assert.equal(signed.publicJwk.kty, "OKP");
  assert.equal(signed.publicJwk.crv, "Ed25519");
  const payload = JSON.parse(Buffer.from(signed.jwt.split(".")[1]!, "base64url").toString("utf8"));
  assert.equal(payload.vc.credentialSubject.attestationScope, "INTERNAL_RECORD_ONLY");
  assert.equal(payload.vc.credentialSubject.methodologyEligibility, "NOT_ASSESSED");
  assert.equal(verifyBaselineAttestation(signed.jwt + "x", pair.publicKey, config.issuerDid, config.keyId, now), false);
  assert.equal(verifyBaselineAttestation(signed.jwt, pair.publicKey, "did:web:attacker.example", config.keyId, now), false);
  assert.equal(verifyBaselineAttestation(signed.jwt, pair.publicKey, config.issuerDid, "did:web:rupaykg.example#rotated-key", now), false);
  assert.equal(verifyBaselineAttestation(signed.jwt, pair.publicKey, config.issuerDid, config.keyId, now + 91 * 86400), false);
});

test("baseline attestation signer fails closed unless issuer, matching key ID and Ed25519 key are configured", () => {
  assert.equal(baselineAttestationConfig({}), null);
  assert.equal(baselineAttestationConfig({
    RUPAYKG_BASELINE_SIGNING_ISSUER_DID: "did:web:rupaykg.example",
    RUPAYKG_BASELINE_SIGNING_KEY_ID: "did:web:other.example#key-1",
    RUPAYKG_BASELINE_SIGNING_PRIVATE_KEY_PEM: "not-a-private-key",
  }), null);
});
