export const GOVERNMENT_INBOX_WORKER_MIN_INTERVAL_SECONDS = 15;
export const GOVERNMENT_INBOX_WORKER_MAX_INTERVAL_SECONDS = 3600;

/** Fail closed: recurring worker execution must be explicitly configured. */
export function readGovernmentInboxWorkerIntervalSeconds(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error("GOVERNMENT_INBOX_WORKER_INTERVAL_SECONDS must be explicitly set to an integer between 15 and 3600; scheduler remains disabled by default");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)
    || value < GOVERNMENT_INBOX_WORKER_MIN_INTERVAL_SECONDS
    || value > GOVERNMENT_INBOX_WORKER_MAX_INTERVAL_SECONDS) {
    throw new Error("GOVERNMENT_INBOX_WORKER_INTERVAL_SECONDS is outside the allowed range 15..3600");
  }
  return value;
}
