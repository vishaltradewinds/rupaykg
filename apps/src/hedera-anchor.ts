import crypto from "node:crypto";
import { AccountId, Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from "@hashgraph/sdk";

export type HederaAnchorState = "NOT_CONFIGURED" | "CONSENSUS_CONFIRMED" | "RETRYABLE_FAILURE" | "FAILED";

export interface AnchorPayload {
  schema: "rupaykg:mrv:v1";
  activityId: string;
  verificationId: string;
  evidenceId: string;
  guardianPolicyId: string;
  guardianExecutionId: string;
  mrvStatus: "VERIFIED";
  methodologyCode?: string;
  quantity?: number;
  unit?: string;
  metadata?: Record<string, unknown>;
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
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(k => `${JSON.stringify(k)}:${canonical(object[k])}`).join(",")}}`;
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
    const message = JSON.stringify({ schema: payload.schema, integrityHash: hash, ...payload, anchoredAt: new Date().toISOString() });
    const response = await new TopicMessageSubmitTransaction().setTopicId(TopicId.fromString(topicId)).setMessage(message).execute(client);
    const record = await response.getRecord(client);
    const consensusTimestamp = record.consensusTimestamp?.toString() ?? null;
    if (!consensusTimestamp) throw new Error("Hedera did not return a consensus timestamp");
    const transactionId = response.transactionId?.toString() ?? null;
    client.close();
    return { status: "CONSENSUS_CONFIRMED", transactionId, consensusTimestamp, topicId, network, integrityHash: hash, message: "MRV provenance anchored to Hedera HCS with consensus confirmation." };
  } catch (error) {
    try { client?.close(); } catch {}
    const message = error instanceof Error ? error.message : String(error);
    const retryable = /timeout|busy|platform_transaction_not_created|connection/i.test(message);
    return { status: retryable ? "RETRYABLE_FAILURE" : "FAILED", transactionId: null, consensusTimestamp: null, topicId, network, integrityHash: hash, message: `Hedera HCS submission failed: ${message}` };
  }
}

export async function verifyHcsMessage(consensusTimestamp: string, topicId = process.env.HEDERA_TOPIC_ID || "") {
  const network = networkName();
  if (!topicId) return { verified: false, network, error: "HEDERA_TOPIC_ID is not configured" };
  const response = await fetch(`${mirrorEndpoint(network)}/api/v1/topics/${encodeURIComponent(topicId)}/messages?limit=100&order=desc`);
  if (!response.ok) return { verified: false, network, error: `Mirror node HTTP ${response.status}` };
  const data = await response.json() as { messages?: Array<{ consensus_timestamp?: string; sequence_number?: number; message?: string }> };
  const found = data.messages?.find(message => message.consensus_timestamp === consensusTimestamp);
  if (!found) return { verified: false, network, error: "Consensus message not found in the mirror-node window" };
  let payload: unknown = null;
  if (found.message) {
    try { payload = JSON.parse(Buffer.from(found.message, "base64").toString("utf8")); }
    catch { payload = Buffer.from(found.message, "base64").toString("utf8"); }
  }
  return { verified: true, network, consensusTimestamp: found.consensus_timestamp, sequenceNumber: found.sequence_number, payload };
}
