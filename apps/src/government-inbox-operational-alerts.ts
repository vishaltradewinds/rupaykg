export type OperationalAlertEvent = "attention_required" | "tick_failed";

export function readOperationalAlertWebhookUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("RUPAYKG_ALERT_WEBHOOK_URL must be a valid HTTPS URL");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new Error("RUPAYKG_ALERT_WEBHOOK_URL must use HTTPS and must not contain userinfo or a fragment");
  }
  return parsed.toString();
}

export async function deliverOperationalAlert(
  endpoint: string,
  event: OperationalAlertEvent,
  details: Record<string, unknown>,
  send: typeof fetch = fetch,
): Promise<{ delivered: boolean; statusCode: number | null; errorClass: string | null }> {
  const safeEndpoint = readOperationalAlertWebhookUrl(endpoint);
  if (!safeEndpoint) throw new Error("RUPAYKG_ALERT_WEBHOOK_URL is not configured");
  try {
    const response = await send(safeEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service: "rupaykg-government-inbox-worker",
        event,
        timestamp: new Date().toISOString(),
        officialGovernmentSubmission: false,
        authoritativeMrvMutation: false,
        guardianSubmission: false,
        details,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return { delivered: response.ok, statusCode: response.status, errorClass: response.ok ? null : "WEBHOOK_HTTP_ERROR" };
  } catch (error) {
    return { delivered: false, statusCode: null, errorClass: error instanceof Error ? error.name : "WEBHOOK_DELIVERY_ERROR" };
  }
}
