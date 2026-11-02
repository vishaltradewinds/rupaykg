import crypto from "node:crypto";
import { AccountId, Client, PrivateKey, TopicId, TopicMessageSubmitTransaction, TransactionId } from "@hiero-ledger/sdk";

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

/**
 * Generate before the HCS side effect and persist on the durable job row.
 * Retries must reuse this exact transaction ID after ambiguous outcomes.
 */
export function createHcsTransactionId(): string {
  const operatorId = process.env.HEDERA_OPERATOR_ID?.trim();
  if (!operatorId || !configured()) throw new Error("HEDERA_OPERATOR_NOT_CONFIGURED");
  return TransactionId.generate(AccountId.fromString(operatorId)).toString();
}

export async function submitHcsAnchor(payload: AnchorPayload, persistedTransactionId?: string): Promise<AnchorResult> {
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
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(message);
    if (persistedTransactionId) transaction.setTransactionId(TransactionId.fromString(persistedTransactionId));
    const response = await transaction.execute(client);
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

export type HcsReconciliationResult =
  | { status: "CONFIRMED"; transactionId: string; consensusTimestamp: string; verification: Record<string, unknown> }
  | { status: "PENDING" | "UNAVAILABLE" | "MISMATCH" | "FAILED"; transactionId: string; message: string };

/**
 * Reconcile an already-persisted HCS transaction ID after an ambiguous submit.
 * A 404 or empty result is PENDING (Mirror Node indexing lag), never proof that
 * the transaction was not accepted and never permission to create a new ID.
 */
export async function reconcileHcsTransaction(
  transactionId: string,
  topicId: string,
  expectedIntegrityHash?: string,
  expectedActivityId?: string,
  expectedVerificationId?: string,
  expectedEvidenceId?: string,
  expectedGuardianExecutionId?: string,
): Promise<HcsReconciliationResult> {
  const id = transactionId.trim();
  const topic = topicId.trim();
  if (!id || !topic) return { status: "MISMATCH", transactionId: id, message: "Persisted HCS transaction ID and topic are required" };
  const mirrorId = id.includes("@") ? id.replace(/^([0-9]+\.[0-9]+\.[0-9]+)@([0-9]+)\.([0-9]+)$/, "$1-$2-$3") : id;
  if (mirrorId === id && !/^[0-9]+\.[0-9]+\.[0-9]+-[0-9]+-[0-9]+$/.test(mirrorId)) {
    return { status: "MISMATCH", transactionId: id, message: "Persisted HCS transaction ID has an unsupported format" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${mirrorEndpoint(networkName())}/api/v1/transactions/${encodeURIComponent(mirrorId)}`, { signal: controller.signal });
    if (response.status === 404) return { status: "PENDING", transactionId: id, message: "Mirror Node has not indexed the persisted transaction yet" };
    if (!response.ok) return { status: "UNAVAILABLE", transactionId: id, message: `Mirror Node transaction lookup returned HTTP ${response.status}` };
    const body = await response.json() as { transactions?: Array<{ transaction_id?: string; result?: string; name?: string; entity_id?: string | null; consensus_timestamp?: string | null }> };
    const transactions = body.transactions ?? [];
    if (!transactions.length) return { status: "PENDING", transactionId: id, message: "Mirror Node returned no transaction record yet" };
    const matching = transactions.find((item) => item.transaction_id === mirrorId || item.transaction_id === id) ?? transactions[0];
    if (!matching) return { status: "PENDING", transactionId: id, message: "Mirror Node returned no matching transaction record yet" };
    if (matching.name !== "CONSENSUS_SUBMIT_MESSAGE" || matching.entity_id !== topic) {
      return { status: "MISMATCH", transactionId: id, message: "Mirror Node transaction type or topic does not match the persisted HCS submission" };
    }
    if (matching.result !== "SUCCESS") {
      if (matching.result === "DUPLICATE_TRANSACTION") return { status: "PENDING", transactionId: id, message: "Mirror Node reports a duplicate node submission; waiting for the successful transaction record" };
      return { status: "FAILED", transactionId: id, message: `HCS transaction was not successful: ${matching.result ?? "UNKNOWN"}` };
    }
    if (!matching.consensus_timestamp) return { status: "PENDING", transactionId: id, message: "Successful transaction is indexed but consensus timestamp is not available yet" };
    const verification = await verifyHcsMessage(matching.consensus_timestamp, topic, expectedIntegrityHash, expectedActivityId, expectedVerificationId, expectedEvidenceId, expectedGuardianExecutionId);
    if (!verification.verified) return { status: "MISMATCH", transactionId: id, message: `Mirror Node found the transaction but HCS message verification failed: ${"error" in verification ? verification.error : "payload mismatch"}` };
    return { status: "CONFIRMED", transactionId: id, consensusTimestamp: matching.consensus_timestamp, verification: verification as unknown as Record<string, unknown> };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Mirror Node transaction lookup timed out" : error instanceof Error ? error.message : String(error);
    return { status: "UNAVAILABLE", transactionId: id, message };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyHcsMessage(consensusTimestamp: string, topicId = process.env.HEDERA_TOPIC_ID || "", expectedIntegrityHash?: string, expectedActivityId?: string, expectedVerificationId?: string, expectedEvidenceId?: string, expectedGuardianExecutionId?: string) {
  const network = networkName();
  if (!topicId) return { verified: false, network, error: "HEDERA_TOPIC_ID is not configured" };
  const response = await fetch(`${mirrorEndpoint(network)}/api/v1/topics/${encodeURIComponent(topicId)}/messages?timestamp=${encodeURIComponent(`eq:${consensusTimestamp}`)}&limit=1&order=desc`);
  if (!response.ok) return { verified: false, network, error: `Mirror node HTTP ${response.status}` };
  const data = await response.json() as { messages?: Array<{ consensus_timestamp?: string; sequence_number?: number; message?: string; topic_id?: string }> };
  const found = data.messages?.find(message => message.consensus_timestamp === consensusTimestamp && (!message.topic_id || message.topic_id === topicId));
  if (!found) return { verified: false, network, error: "Consensus message not found for the supplied Hedera topic and consensus timestamp" };
  let payload: unknown = null;
  if (found.message) {
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
