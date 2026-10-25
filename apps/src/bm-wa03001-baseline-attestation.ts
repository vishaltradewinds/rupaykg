import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";

export interface BaselineAttestationClaims {
  issuerDid: string;
  keyId: string;
  baselineRecordId: string;
  activityId: string;
  organizationId: string;
  methodologyCode: "BM WA03.001";
  methodologyVersion: "1.0";
  baselineFch4Tch4: number;
  baselinePeriod: string;
  baselineRecordSha256: string;
  baselineEvidenceIds: string[];
  approvedByIdentityId: string;
  approvedAt: string;
  issuedAt: number;
  expiresAt: number;
}

export interface BaselineAttestationConfig {
  issuerDid: string;
  keyId: string;
  privateKeyPem: string;
}

export function baselineAttestationConfig(env: NodeJS.ProcessEnv = process.env): BaselineAttestationConfig | null {
  const issuerDid = env.RUPAYKG_BASELINE_SIGNING_ISSUER_DID?.trim();
  const keyId = env.RUPAYKG_BASELINE_SIGNING_KEY_ID?.trim();
  const privateKeyPem = env.RUPAYKG_BASELINE_SIGNING_PRIVATE_KEY_PEM?.replace(/\\n/g, "\n").trim();
  if (!issuerDid || !issuerDid.startsWith("did:") || !keyId || !keyId.startsWith(issuerDid + "#") || !privateKeyPem) return null;
  try {
    const key = createPrivateKey(privateKeyPem);
    if (key.asymmetricKeyType !== "ed25519") return null;
  } catch { return null; }
  return { issuerDid, keyId, privateKeyPem };
}

const b64u = (value: Buffer | string): string => Buffer.from(value).toString("base64url");
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => JSON.stringify(key) + ":" + canonical(child)).join(",") + "}";
};

export function baselineAttestationPublicJwk(config: BaselineAttestationConfig): JsonWebKey {
  return createPublicKey(createPrivateKey(config.privateKeyPem)).export({ format: "jwk" }) as JsonWebKey;
}

export function signBaselineAttestation(claims: BaselineAttestationClaims, config: BaselineAttestationConfig): { jwt: string; sha256: string; publicJwk: JsonWebKey } {
  const key = createPrivateKey(config.privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("Baseline attestation signing key must be Ed25519");
  if (claims.issuerDid !== config.issuerDid || claims.keyId !== config.keyId) throw new Error("Baseline attestation issuer/key configuration mismatch");
  if (!/^[a-f0-9]{64}$/.test(claims.baselineRecordSha256) || !Number.isFinite(claims.baselineFch4Tch4) || claims.baselineFch4Tch4 < 0) throw new Error("Baseline attestation claim validation failed");
  const header = { alg: "EdDSA", typ: "vc+jwt", kid: config.keyId };
  const payload = {
    iss: config.issuerDid,
    sub: claims.baselineRecordId,
    jti: "urn:uuid:" + claims.baselineRecordId,
    iat: claims.issuedAt,
    nbf: claims.issuedAt,
    exp: claims.expiresAt,
    vc: {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        {
          "RupayKgBaselineAttestation": "urn:rupaykg:bm-wa03001:BaselineAttestation",
          "activityId": "urn:rupaykg:bm-wa03001:activityId",
          "organizationId": "urn:rupaykg:bm-wa03001:organizationId",
          "baselineRecordId": "urn:rupaykg:bm-wa03001:baselineRecordId",
          "methodologyCode": "urn:rupaykg:bm-wa03001:methodologyCode",
          "methodologyVersion": "urn:rupaykg:bm-wa03001:methodologyVersion",
          "fch4BL": { "@id": "urn:rupaykg:bm-wa03001:fch4BL", "@type": "http://www.w3.org/2001/XMLSchema#decimal" },
          "baselinePeriod": "urn:rupaykg:bm-wa03001:baselinePeriod",
          "baselineRecordSha256": "urn:rupaykg:bm-wa03001:baselineRecordSha256",
          "baselineEvidenceIds": { "@id": "urn:rupaykg:bm-wa03001:baselineEvidenceIds", "@container": "@set" },
          "approvedByIdentityId": "urn:rupaykg:bm-wa03001:approvedByIdentityId",
          "approvedAt": { "@id": "urn:rupaykg:bm-wa03001:approvedAt", "@type": "http://www.w3.org/2001/XMLSchema#dateTime" },
          "attestationScope": "urn:rupaykg:bm-wa03001:attestationScope",
          "methodologyEligibility": "urn:rupaykg:bm-wa03001:methodologyEligibility"
        }
      ],
      type: ["VerifiableCredential", "RupayKgBaselineAttestation"],
      issuer: config.issuerDid,
      issuanceDate: new Date(claims.issuedAt * 1000).toISOString(),
      expirationDate: new Date(claims.expiresAt * 1000).toISOString(),
      credentialSubject: {
        id: claims.baselineRecordId,
        activityId: claims.activityId,
        organizationId: claims.organizationId,
        baselineRecordId: claims.baselineRecordId,
        methodologyCode: claims.methodologyCode,
        methodologyVersion: claims.methodologyVersion,
        fch4BL: claims.baselineFch4Tch4,
        baselinePeriod: claims.baselinePeriod,
        baselineRecordSha256: claims.baselineRecordSha256,
        baselineEvidenceIds: [...claims.baselineEvidenceIds].sort(),
        approvedByIdentityId: claims.approvedByIdentityId,
        approvedAt: claims.approvedAt,
        attestationScope: "INTERNAL_RECORD_ONLY",
        methodologyEligibility: "NOT_ASSESSED",
      },
    },
  };
  const signingInput = b64u(canonical(header)) + "." + b64u(canonical(payload));
  const signature = sign(null, Buffer.from(signingInput), key);
  const jwt = signingInput + "." + signature.toString("base64url");
  const publicKey = createPublicKey(key);
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  return { jwt, sha256: createHash("sha256").update(jwt).digest("hex"), publicJwk };
}

export function verifyBaselineAttestation(jwt: string, publicKey: KeyObject | string | Buffer, expectedIssuer: string, expectedKeyId: string, now = Math.floor(Date.now() / 1000)): boolean {
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8")) as Record<string, unknown>;
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
    if (header.alg !== "EdDSA" || header.typ !== "vc+jwt" || header.kid !== expectedKeyId || payload.iss !== expectedIssuer ||
      typeof payload.nbf !== "number" || payload.nbf > now || typeof payload.exp !== "number" || payload.exp <= now) return false;
    return verify(null, Buffer.from(parts[0]! + "." + parts[1]!), publicKey, Buffer.from(parts[2]!, "base64url"));
  } catch { return false; }
}
