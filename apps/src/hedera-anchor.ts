import crypto from "node:crypto";
import { AccountId, Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";

export type HederaAnchorState = "NOT_CONFIGURED" | "CONSENSUS_CONFIRMED" | "RETRYABLE_FAILURE" | "FAILED";

export interface AnchorPayload {
  schema: "rupaykg:mrv:v1";
  activityId: string;
  verificationId: string;
  evidenceId: string;
  guardianPolicyId: string;
  guardianExecutionId: string;
  mrvStatus: "VERIFIED";
  methodologyCode?: string | undefined;
  quantity?: number | undefined;
  unit?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface AnchorResult {
  status: HederaAnchorState;
  transactionId: string | null;
  consensusTimestamp: string | null;
  topicId: string;
  network: string;
  integrityHash: string;
  message: string;
}

function networkName(): "testnet" | "mainnet" | "previewnet" {
  const value = process.env.HEDERA_NETWORK?.trim().toLowerCase();
  return value === "mainnet" || value === "previewnet" ? value : "testnet";
}

function mirrorEndpoint(network: string): string {
  if (network === "mainnet") return "https://mainnet-public.mirrornode.hedera.com";
  if (network === "previewnet") return "https://previewnet.mirrornode.hedera.com";
  return "https://testnet.mirrornode.hedera.com";
}

function configured(): boolean {
  const id = process.env.HEDERA_OPERATOR_ID?.trim();
  const key = process.env.HEDERA_OPERATOR_KEY?.trim();
  const topic = process.env.HEDERA_TOPIC_ID?.trim();
  return Boolean(id && key && topic && key.length >= 20 && !/placeholder|your_/i.test(key));
}

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).filter(key => object[key] !== undefined).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

export function integrityHash(payload: AnchorPayload): string {
  return crypto.createHash("sha256").update(canonical(payload)).digest("hex");
}

export function hederaStatus() {
  const network = networkName();
  return {
    readStatus: "AVAILABLE" as const,
    writeStatus: configured() ? "AVAILABLE" as const : "NOT_AVAILABLE" as const,
    consensusStatus: configured() ? "CONFIGURED" as const : "NOT_AVAILABLE" as const,
    network,
    mirrorNodeEndpoint: mirrorEndpoint(network),
    topicId: process.env.HEDERA_TOPIC_ID || "NOT_CONFIGURED",
    configured: configured(),
    syntheticData: false,
  };
}

export async function submitHcsAnchor(payload: AnchorPayload): Promise<AnchorResult> {
  const network = networkName();
  const topicId = process.env.HEDERA_TOPIC_ID?.trim() || "";
  const hash = integrityHash(payload);
  if (!topicId || !configured()) {
    return { status: "NOT_CONFIGURED", transactionId: null, consensusTimestamp: null, topicId, network, integrityHash: hash, message: "Hedera HCS anchoring is unavailable until real operator credentials and a topic are configured." };
  }

  let client: Client | undefined;
  try {
    if (network === "mainnet") client = Client.forMainnet();
    else if (network === "previewnet") client = Client.forPreviewnet();
    else client = Client.forTestnet();
    client.setOperator(AccountId.fromString(process.env.HEDERA_OPERATOR_ID!), PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!));
    const message = JSON.stringify({ ...payload, integrityHash: hash, anchoredAt: new Date().toISOString() });
    const response = await new TopicMessageSubmitTransaction().setTopicId(TopicId.fromString(topicId)).setMessage(message).execute(client);
    const record = await response.getRecord(client);
    const consensusTimestamp = record.consensusTimestamp?.toString() ?? null;
    if (!consensusTimestamp) throw new Error("Hedera did not return a consensus timestamp");
    const transactionId = response.transactionId?.toString() ?? null;
    if (!transactionId) throw new Error("Hedera did not return a transaction identifier");
    client.close();
    return { status: "CONSENSUS_CONFIRMED", transactionId, consensusTimestamp, topicId, network, integrityHash: hash, message: "MRV provenance anchored to Hedera HCS with consensus confirmation." };
  } catch (error) {
    try { client?.close(); } catch {}
    const message = error instanceof Error ? error.message : String(error);
    const retryable = /timeout|busy|platform_transaction_not_created|connection/i.test(message);
    return { status: retryable ? "RETRYABLE_FAILURE" : "FAILED", transactionId: null, consensusTimestamp: null, topicId, network, integrityHash: hash, message: `Hedera HCS submission failed: ${message}` };
  }
}

class MirrorNodeResponseTooLargeError extends Error {}

function mirrorNodeTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.HEDERA_MIRROR_NODE_TIMEOUT_MS || "8000", 10);
  return Number.isFinite(parsed) && parsed >= 500 && parsed <= 30000 ? parsed : 8000;
}

function mirrorNodeMaxResponseBytes(): number {
  const parsed = Number.parseInt(process.env.HEDERA_MIRROR_NODE_MAX_RESPONSE_BYTES || "524288", 10);
  return Number.isFinite(parsed) && parsed >= 1024 && parsed <= 2097152 ? parsed : 524288;
}

async function readBoundedMirrorNodeResponse(response: Response, limit: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) throw new MirrorNodeResponseTooLargeError();
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        throw new MirrorNodeResponseTooLargeError();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function verifyHcsMessage(consensusTimestamp: string, topicId = process.env.HEDERA_TOPIC_ID || "", expectedIntegrityHash?: string, expectedActivityId?: string, expectedVerificationId?: string, expectedEvidenceId?: string, expectedGuardianExecutionId?: string) {
  const network = networkName();
  if (!topicId) return { verified: false, network, error: "HEDERA_TOPIC_ID is not configured" };
  const timeout = mirrorNodeTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let data: { messages: Array<{ consensus_timestamp?: string; sequence_number?: number; message?: string; topic_id?: string }> };
  try {
    const response = await fetch(`${mirrorEndpoint(network)}/api/v1/topics/${encodeURIComponent(topicId)}/messages?timestamp=${encodeURIComponent(`eq:${consensusTimestamp}`)}&limit=1&order=desc`, { signal: controller.signal });
    if (!response.ok) return { verified: false, network, error: `Mirror node HTTP ${response.status}` };
    const bytes = await readBoundedMirrorNodeResponse(response, mirrorNodeMaxResponseBytes());
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray((parsed as Record<string, unknown>).messages)) {
      return { verified: false, network, error: "Mirror Node response has an invalid message collection" };
    }
    data = parsed as typeof data;
  } catch (error) {
    if (error instanceof MirrorNodeResponseTooLargeError) return { verified: false, network, error: "Mirror Node response exceeded the configured size limit" };
    if (error instanceof SyntaxError) return { verified: false, network, error: "Mirror Node returned malformed JSON" };
    if (error instanceof Error && error.name === "AbortError") return { verified: false, network, error: `Mirror Node request timed out after ${timeout}ms` };
    return { verified: false, network, error: "Mirror Node request failed" };
  } finally {
    clearTimeout(timer);
  }
  const found = data.messages.find(message => message.consensus_timestamp === consensusTimestamp && message.topic_id === topicId);
  if (!found) return { verified: false, network, error: "Consensus message not found for the supplied Hedera topic and consensus timestamp" };
  let payload: unknown = null;
  if (typeof found.message === "string") {
    try { payload = JSON.parse(Buffer.from(found.message, "base64").toString("utf8")); }
    catch { payload = Buffer.from(found.message, "base64").toString("utf8"); }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { verified: false, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, payload, error: "HCS message payload is not a structured RupayKG provenance record" };
  const record = payload as Record<string, unknown>;
  const requiredMatches = [
    ["schema", "rupaykg:mrv:v1"],
    ["mrvStatus", "VERIFIED"],
    ...(expectedIntegrityHash ? [["integrityHash", expectedIntegrityHash]] as const : []),
    ...(expectedActivityId ? [["activityId", expectedActivityId]] as const : []),
    ...(expectedVerificationId ? [["verificationId", expectedVerificationId]] as const : []),
    ...(expectedEvidenceId ? [["evidenceId", expectedEvidenceId]] as const : []),
    ...(expectedGuardianExecutionId ? [["guardianExecutionId", expectedGuardianExecutionId]] as const : []),
  ];
  for (const [field, expected] of requiredMatches) if (record[field] !== expected) return { verified: false, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, payload, error: `HCS provenance field mismatch: ${field}` };
  const { integrityHash: anchoredHash, anchoredAt: _anchoredAt, ...unsignedPayload } = record;
  const candidate = unsignedPayload as unknown as AnchorPayload;
  if (typeof anchoredHash !== "string" || integrityHash(candidate) !== anchoredHash) return { verified: false, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, payload, error: "HCS integrity hash does not match the anchored provenance payload" };
  return { verified: true, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, payload };
}
