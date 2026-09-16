import { createVerify } from "node:crypto";

const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certCache: { expiresAt: number; keys: Record<string, string> } | null = null;

type FirebaseClaims = {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  auth_time: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function b64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "="), "base64");
}

async function certificates(): Promise<Record<string, string>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.keys;
  const response = await fetch(CERT_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Firebase certificate endpoint returned ${response.status}`);
  const keys = await response.json() as Record<string, string>;
  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] ?? 3600);
  certCache = { keys, expiresAt: Date.now() + Math.max(60, Math.min(maxAge, 86400)) * 1000 };
  return keys;
}

export async function verifyFirebaseIdToken(token: string, projectId = process.env.FIREBASE_PROJECT_ID?.trim()): Promise<FirebaseClaims> {
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required for Firebase authentication");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase ID token format");
  const header = JSON.parse(b64url(parts[0]!).toString("utf8")) as { alg?: string; kid?: string };
  const payload = JSON.parse(b64url(parts[1]!).toString("utf8")) as FirebaseClaims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Firebase ID token signing algorithm");
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Firebase ID token project mismatch");
  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || payload.sub.length > 128 || payload.exp <= now || payload.iat > now + 60 || payload.auth_time > now + 60) throw new Error("Firebase ID token time or subject claims are invalid");
  const keys = await certificates();
  let publicKey = keys[header.kid];
  if (!publicKey) {
    certCache = null;
    const refreshed = await certificates();
    publicKey = refreshed[header.kid];
    if (!publicKey) throw new Error("Firebase ID token signing key is unknown");
  }
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]!}.${parts[1]!}`);
  verifier.end();
  if (!verifier.verify(publicKey, b64url(parts[2]!))) throw new Error("Firebase ID token signature is invalid");
  return payload;
}
