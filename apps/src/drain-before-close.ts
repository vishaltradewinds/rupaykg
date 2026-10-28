export interface DrainBeforeCloseOptions {
  isInFlight: () => boolean;
  close: () => Promise<void>;
  timeoutMs: number;
  pollIntervalMs?: number;
  onTimeout?: () => void;
}

/**
 * Drain active work before closing resources it may still be using.
 * A timeout marks shutdown as unclean, but never closes resources under active work.
 */
export async function drainBeforeClose(options: DrainBeforeCloseOptions): Promise<{ timedOut: boolean }> {
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const deadline = Date.now() + options.timeoutMs;

  while (options.isInFlight() && Date.now() < deadline) {
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(pollIntervalMs, Math.max(1, deadline - Date.now()))));
  }

  const timedOut = options.isInFlight();
  if (timedOut) options.onTimeout?.();

  // After the grace deadline, wait for the active operation to settle before closing
  // the pool. This may take longer than the grace period, intentionally.
  while (options.isInFlight()) {
    await new Promise<void>(resolve => setTimeout(resolve, pollIntervalMs));
  }

  await options.close();
  return { timedOut };
}
