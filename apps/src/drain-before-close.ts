export interface DrainBeforeCloseOptions {
  isInFlight: () => boolean;
  close: () => Promise<void>;
  timeoutMs: number;
  // Required: the helper must never silently return with active work still running.
  terminate: (exitCode: number) => void;
  secondStageTimeoutMs?: number;
  closeTimeoutMs?: number;
  pollIntervalMs?: number;
  onTimeout?: () => void;
  onForcedTermination?: () => void;
  onCloseFailure?: (reason: "timeout" | "rejected") => void;
}

export interface DrainBeforeCloseResult {
  timedOut: boolean;
  forcedTermination: boolean;
}

type CloseOutcome =
  | { kind: "closed" }
  | { kind: "timeout" }
  | { kind: "rejected" };

/**
 * Close resources only after active work has drained, and bound the close
 * operation itself so a stuck driver/socket cannot hang process shutdown.
 */
async function closeWithinDeadline(
  close: () => Promise<void>,
  timeoutMs: number,
): Promise<CloseOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const closeOutcome = Promise.resolve()
    .then(close)
    .then<CloseOutcome, CloseOutcome>(
      () => ({ kind: "closed" }),
      () => ({ kind: "rejected" }),
    );
  const timeoutOutcome = new Promise<CloseOutcome>(resolve => {
    timer = setTimeout(() => resolve({ kind: "timeout" }), timeoutMs);
  });

  try {
    return await Promise.race([closeOutcome, timeoutOutcome]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Drain active work before closing resources it may still be using.
 * After the grace period, allow one bounded second-stage drain. If work remains
 * stuck, terminate the process without closing resources underneath that work.
 * Resource closure is also bounded; a timeout or rejection requests termination.
 */
export async function drainBeforeClose(
  options: DrainBeforeCloseOptions,
): Promise<DrainBeforeCloseResult> {
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const secondStageTimeoutMs = options.secondStageTimeoutMs ?? 5_000;
  const closeTimeoutMs = options.closeTimeoutMs ?? 5_000;
  const waitForChangeUntil = async (deadline: number) => {
    while (options.isInFlight() && Date.now() < deadline) {
      await new Promise<void>(resolve =>
        setTimeout(resolve, Math.min(pollIntervalMs, Math.max(1, deadline - Date.now()))),
      );
    }
  };

  const closeOrTerminate = async (timedOut: boolean): Promise<DrainBeforeCloseResult> => {
    const outcome = await closeWithinDeadline(options.close, closeTimeoutMs);
    if (outcome.kind === "closed") {
      return { timedOut, forcedTermination: false };
    }

    // Logging is best-effort; it must not prevent termination on close failure.
    try {
      options.onCloseFailure?.(outcome.kind);
    } catch {
      // Termination takes priority over observability.
    }
    options.terminate(1);
    return { timedOut: true, forcedTermination: true };
  };

  await waitForChangeUntil(Date.now() + options.timeoutMs);
  if (!options.isInFlight()) {
    return closeOrTerminate(false);
  }

  // Observability callbacks must not defeat the bounded shutdown policy.
  try {
    options.onTimeout?.();
  } catch {
    // Continue draining even if timeout reporting fails.
  }
  await waitForChangeUntil(Date.now() + secondStageTimeoutMs);
  if (!options.isInFlight()) {
    return closeOrTerminate(true);
  }

  // Never close a resource while active work may still be using it.
  // Ensure termination is requested even if the forced-termination logger fails.
  try {
    options.onForcedTermination?.();
  } catch {
    // Termination takes priority over best-effort observability.
  }
  options.terminate(1);
  return { timedOut: true, forcedTermination: true };
}
