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

export function canonicalIntegrityHash(value: unknown): string {
  return crypto.createHash("sha256").update(canonical(value)).digest("hex");
}

export function integrityHash(payload: AnchorPayload): string {
  return canonicalIntegrityHash(payload);
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
    const transactionId = response.transactionId?.toString().trim() || null;
    if (!transactionId) throw new Error("Hedera did not return a transaction identifier");
    client.close();
    return { status: "CONSENSUS_CONFIRMED", transactionId, consensusTimestamp, topicId, network, integrityHash: hash, message: "MRV provenance anchored to Hedera HCS with consensus confirmation." };
  } catch (error) {
    try { client?.close(); } catch {}
    const safeMessage = error instanceof Error ? error.message : "";
    const retryable = /timeout|busy|platform_transaction_not_created|connection/i.test(safeMessage);
    return { status: retryable ? "RETRYABLE_FAILURE" : "FAILED", transactionId: null, consensusTimestamp: null, topicId, network, integrityHash: hash, message: retryable ? "Hedera HCS submission failed due to a retryable network or service condition." : "Hedera HCS submission failed; provider details were withheld." };
  }
}

const MIRROR_NODE_TIMEOUT_MS = 8000;
const MIRROR_NODE_MAX_RESPONSE_BYTES = 1024 * 1024;
const MIRROR_NODE_MAX_MESSAGE_BYTES = 256 * 1024;

async function readMirrorBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MIRROR_NODE_MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("MIRROR_RESPONSE_TOO_LARGE");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MIRROR_NODE_MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("MIRROR_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function verifyHcsMessage(consensusTimestamp: string, topicId = process.env.HEDERA_TOPIC_ID || "", expectedIntegrityHash?: string, expectedActivityId?: string, expectedVerificationId?: string, expectedEvidenceId?: string, expectedGuardianExecutionId?: string) {
  const network = networkName();
  if (!/^\\d+\\.\\d+\\.\\d+$/.test(topicId)) return { verified: false, network, error: "A valid Hedera topic ID is required" };
  if (!/^\\d{10,}\\.\\d{1,9}$/.test(consensusTimestamp)) return { verified: false, network, error: "A valid Hedera consensus timestamp is required" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MIRROR_NODE_TIMEOUT_MS);
  try {
    const response = await fetch(`${mirrorEndpoint(network)}/api/v1/topics/${encodeURIComponent(topicId)}/messages?timestamp=${encodeURIComponent(`eq:${consensusTimestamp}`)}&limit=1&order=desc`, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { verified: false, network, error: `Mirror node HTTP ${response.status}` };
    }
    let text: string;
    try { text = await readMirrorBody(response); }
    catch (error) {
      return { verified: false, network, error: error instanceof Error && error.message === "MIRROR_RESPONSE_TOO_LARGE" ? "Mirror Node response exceeded the configured size limit" : "Mirror Node response could not be safely read" };
    }
    let data: { messages?: Array<{ consensus_timestamp?: string; sequence_number?: number; message?: string; topic_id?: string }> };
    try { data = JSON.parse(text) as typeof data; }
    catch { return { verified: false, network, error: "Mirror Node returned malformed JSON" }; }
    if (!data || typeof data !== "object" || !Array.isArray(data.messages)) return { verified: false, network, error: "Mirror Node response has an invalid shape" };
    const found = data.messages.find(message => message && message.consensus_timestamp === consensusTimestamp && message.topic_id === topicId);
    if (!found) return { verified: false, network, error: "Consensus message not found for the supplied Hedera topic and consensus timestamp" };
    if (typeof found.message !== "string" || found.message.length === 0 || found.message.length > Math.ceil(MIRROR_NODE_MAX_MESSAGE_BYTES * 4 / 3)) return { verified: false, network, error: "HCS message is missing or exceeds the configured size limit" };
    let decoded: Buffer;
    try { decoded = Buffer.from(found.message, "base64"); }
    catch { return { verified: false, network, error: "HCS message is not valid base64" }; }
    if (decoded.byteLength > MIRROR_NODE_MAX_MESSAGE_BYTES) return { verified: false, network, error: "HCS message exceeds the configured size limit" };
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded)); }
    catch { return { verified: false, network, error: "HCS message is not valid UTF-8 JSON" }; }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { verified: false, network, error: "HCS message payload is not a structured RupayKG provenance record" };
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
    for (const [field, expected] of requiredMatches) if (record[field] !== expected) return { verified: false, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, error: `HCS provenance field mismatch: ${field}` };
    const { integrityHash: anchoredHash, anchoredAt: _anchoredAt, ...unsignedPayload } = record;
    const candidate = unsignedPayload as unknown as AnchorPayload;
    if (typeof anchoredHash !== "string" || integrityHash(candidate) !== anchoredHash) return { verified: false, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, error: "HCS integrity hash does not match the anchored provenance payload" };
    return { verified: true, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, payload };
  } catch (error) {
    return { verified: false, network, error: error instanceof Error && error.name === "AbortError" ? "Mirror Node request timed out" : "Mirror Node request failed due to a network error" };
  } finally {
    clearTimeout(timer);
  }
}
