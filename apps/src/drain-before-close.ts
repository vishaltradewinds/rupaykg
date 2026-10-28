export interface DrainBeforeCloseOptions {
  isInFlight: () => boolean;
  close: () => Promise<void>;
  timeoutMs: number;
  // Required: the helper must never silently return with active work still running.
  terminate: (exitCode: number) => void;
  secondStageTimeoutMs?: number;
  pollIntervalMs?: number;
  onTimeout?: () => void;
  onForcedTermination?: () => void;
}

export interface DrainBeforeCloseResult {
  timedOut: boolean;
  forcedTermination: boolean;
}

/**
 * Drain active work before closing resources it may still be using.
 * After the grace period, allow one bounded second-stage drain. If work remains
 * stuck, terminate the process without closing resources underneath that work.
 */
export async function drainBeforeClose(
  options: DrainBeforeCloseOptions,
): Promise<DrainBeforeCloseResult> {
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const secondStageTimeoutMs = options.secondStageTimeoutMs ?? 5_000;
  const waitForChangeUntil = async (deadline: number) => {
    while (options.isInFlight() && Date.now() < deadline) {
      await new Promise<void>(resolve =>
        setTimeout(resolve, Math.min(pollIntervalMs, Math.max(1, deadline - Date.now()))),
      );
    }
  };

  await waitForChangeUntil(Date.now() + options.timeoutMs);
  if (!options.isInFlight()) {
    await options.close();
    return { timedOut: false, forcedTermination: false };
  }

  options.onTimeout?.();
  await waitForChangeUntil(Date.now() + secondStageTimeoutMs);
  if (!options.isInFlight()) {
    await options.close();
    return { timedOut: true, forcedTermination: false };
  }

  // Never close a resource while active work may still be using it.
  options.onForcedTermination?.();
  options.terminate(1);
  return { timedOut: true, forcedTermination: true };
}
