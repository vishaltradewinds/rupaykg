import crypto from "node:crypto";
import { AccountId, Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { readBoundedResponseBody, ResponseBodyTooLargeError } from "./bounded-response.js";

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

function boundedSetting(name: string, fallback: number, minimum: number, maximum: number, legacyName?: string): number {
  const configured = process.env[name] ?? (legacyName ? process.env[legacyName] : undefined);
  const parsed = Number.parseInt(configured ?? String(fallback), 10);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function mirrorTimeoutMs(): number {
  return boundedSetting("HEDERA_MIRROR_TIMEOUT_MS", 10000, 1000, 30000, "HEDERA_MIRROR_NODE_TIMEOUT_MS");
}

function mirrorMaxResponseBytes(): number {
  return boundedSetting("HEDERA_MIRROR_MAX_RESPONSE_BYTES", 262144, 1024, 2_097_152, "HEDERA_MIRROR_NODE_MAX_RESPONSE_BYTES");
}

function mirrorMaxMessageBytes(): number {
  return boundedSetting("HEDERA_MIRROR_MAX_MESSAGE_BYTES", 65536, 1024, 1_048_576);
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

export async function verifyHcsMessage(consensusTimestamp: string, topicId = process.env.HEDERA_TOPIC_ID || "", expectedIntegrityHash?: string, expectedActivityId?: string, expectedVerificationId?: string, expectedEvidenceId?: string, expectedGuardianExecutionId?: string) {
  const network = networkName();
  if (!topicId) return { verified: false, network, errorCode: "MIRROR_NODE_TOPIC_REQUIRED", error: "HEDERA_TOPIC_ID is not configured" };
  if (!/^\d+\.\d{1,9}$/.test(consensusTimestamp)) {
    return { verified: false, network, errorCode: "MIRROR_NODE_TIMESTAMP_INVALID", error: "Hedera consensus timestamp format is invalid" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), mirrorTimeoutMs());
  let responseDigest: string | undefined;
  try {
    const response = await fetch(
      mirrorEndpoint(network) + "/api/v1/topics/" + encodeURIComponent(topicId) + "/messages?timestamp=" + encodeURIComponent("eq:" + consensusTimestamp) + "&limit=1&order=desc",
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { verified: false, network, errorCode: "MIRROR_NODE_HTTP_ERROR", error: "Mirror Node HTTP " + response.status };
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      await response.body?.cancel().catch(() => undefined);
      return { verified: false, network, errorCode: "MIRROR_NODE_CONTENT_TYPE_INVALID", error: "Mirror Node returned a non-JSON response" };
    }

    let bounded;
    try {
      bounded = await readBoundedResponseBody(response, mirrorMaxResponseBytes());
    } catch (error) {
      if (error instanceof ResponseBodyTooLargeError) {
        return { verified: false, network, errorCode: "MIRROR_NODE_RESPONSE_TOO_LARGE", error: "Mirror Node response exceeded the configured size limit" };
      }
      throw error;
    }
    responseDigest = bounded.sha256;

    let parsed: unknown;
    try {
      parsed = JSON.parse(bounded.text);
    } catch {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_INVALID_JSON", error: "Mirror Node returned invalid JSON" };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray((parsed as Record<string, unknown>).messages)) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_RESPONSE_SHAPE_INVALID", error: "Mirror Node response did not contain a messages array" };
    }

    const messages = (parsed as { messages: unknown[] }).messages;
    if (messages.length !== 1 || !messages[0] || typeof messages[0] !== "object" || Array.isArray(messages[0])) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_MESSAGE_COUNT_INVALID", error: "Mirror Node did not return exactly one message for the requested consensus timestamp" };
    }
    const found = messages[0] as Record<string, unknown>;
    if (found.consensus_timestamp !== consensusTimestamp) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_TIMESTAMP_MISMATCH", error: "Mirror Node consensus timestamp did not match the requested timestamp" };
    }
    if (found.topic_id !== topicId) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_TOPIC_MISMATCH", error: "Mirror Node topic identifier did not match the requested topic" };
    }
    if (typeof found.sequence_number !== "number" || !Number.isSafeInteger(found.sequence_number) || found.sequence_number < 0) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_SEQUENCE_INVALID", error: "Mirror Node sequence number is invalid" };
    }
    if (typeof found.message !== "string" || !found.message) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_MESSAGE_MISSING", error: "Mirror Node message body is missing" };
    }

    const maxMessageBytes = mirrorMaxMessageBytes();
    const maxEncodedLength = Math.ceil(maxMessageBytes / 3) * 4 + 4;
    const encoded = found.message;
    if (encoded.length > maxEncodedLength) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_MESSAGE_TOO_LARGE", error: "Mirror Node message exceeded the configured size limit" };
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_MESSAGE_ENCODING_INVALID", error: "Mirror Node message is not valid base64" };
    }
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.byteLength > maxMessageBytes || decoded.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_MESSAGE_TOO_LARGE", error: "Mirror Node message exceeded the configured size limit or was not canonical base64" };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded));
    } catch {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_PAYLOAD_INVALID", error: "HCS message was not valid UTF-8 JSON" };
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { verified: false, network, responseDigest, errorCode: "MIRROR_NODE_PAYLOAD_SHAPE_INVALID", error: "HCS message payload is not a structured RupayKG provenance record" };
    }

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
    for (const [field, expected] of requiredMatches) {
      if (record[field] !== expected) {
        return { verified: false, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, responseDigest, errorCode: "MIRROR_NODE_PROVENANCE_MISMATCH", error: "HCS provenance field mismatch: " + field };
      }
    }

    const { integrityHash: anchoredHash, anchoredAt: _anchoredAt, ...unsignedPayload } = record;
    const candidate = unsignedPayload as unknown as AnchorPayload;
    if (typeof anchoredHash !== "string" || integrityHash(candidate) !== anchoredHash) {
      return { verified: false, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, responseDigest, errorCode: "MIRROR_NODE_INTEGRITY_MISMATCH", error: "HCS integrity hash does not match the anchored provenance payload" };
    }
    return {
      verified: true,
      network,
      consensusTimestamp: found.consensus_timestamp,
      sequenceNumber: found.sequence_number,
      responseDigest,
      payload,
    };
  } catch (error) {
    const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return {
      verified: false,
      network,
      ...(responseDigest ? { responseDigest } : {}),
      errorCode: timedOut ? "MIRROR_NODE_TIMEOUT" : "MIRROR_NODE_UNAVAILABLE",
      error: timedOut ? "Mirror Node request timed out after " + mirrorTimeoutMs() + "ms" : "Mirror Node request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
