# Government Inbox Worker Operations

Status: engineering capability only; production scheduler is not enabled or certified.

## Scope and safety boundary

The worker validates the internal structure of inbox batches. VALIDATED is an internal structural state only. It does not mean CPCB/BEE submission, authority acceptance, statutory compliance, verified MRV, CCTS verification, or Carbon Credit Certificate issuance. The worker does not mutate authoritative MRV values and does not submit to Guardian/Hedera or a government portal.

The scheduler is a separate process, not part of the web/API server. It fails closed unless GOVERNMENT_INBOX_WORKER_INTERVAL_SECONDS is explicitly set to an integer from 15 through 3600. The default deployment configuration does not set this variable. Do not enable it in production until the staging and Shakti release gates below are signed off.

## Local / isolated staging invocation

1. Use a dedicated disposable or isolated staging PostgreSQL database, never production for acceptance tests.
2. Apply the controlled migration set using the repository's migration validation process.
3. Build the API package.
4. Set the scheduler interval explicitly, for example GOVERNMENT_INBOX_WORKER_INTERVAL_SECONDS=60, and use the repository's documented database TLS settings.
5. Start the separate scheduler process with npm run worker:gov-inbox:scheduler -w @rupaykg/api.
6. Confirm scheduler_started, tick_completed, and shutdown_completed events. Confirm aggregate counts only; payloads, evidence content, credentials, and tokens must never be logged.
7. Send SIGTERM and confirm graceful shutdown. Do not enable automatic restarts until repeat-run, lease-expiry, retry, quarantine, and shutdown tests pass in isolated staging.

## Monitoring signals

The scheduler emits structured JSON to stdout:
- tick_completed: run duration, claimed/validated/rejected/retried/quarantined counts, unresolved queue status counts, expired lease count, oldest unresolved timestamp.
- attention_required: emitted when an item is quarantined or an expired lease is detected.
- tick_failed: emitted when a tick fails; it includes the error class, never payloads.
- shutdown_started and shutdown_completed: process lifecycle evidence.

These are log signals only. No external log drain, pager, notification destination, service supervisor, or production scheduler has been configured by this change. A real operations owner must wire these signals into the chosen monitoring platform and verify delivery before production activation.

## Minimum release gates before production activation

- Run the scheduler against isolated staging using synthetic fixtures only.
- Demonstrate multiple cycles, no overlapping work, idempotent claims, stale lease fencing, retry backoff, max-attempt quarantine, and recovery after process restart.
- Validate DB connection/TLS configuration, graceful shutdown, and process restart policy.
- Configure and test external alert delivery with an accountable on-call owner and documented escalation.
- Verify endpoint-level authorization and persistence tests for CPCB workspaces.
- Obtain documented official API authorization and approved schemas/sandbox before calling any government integration live.
- Complete real Guardian/Hedera/Mirror Node acceptance separately; no worker status substitutes for it.
- Obtain the Shakti production gate approval and change-management approval.

Until all gates are closed, keep this scheduler disabled in production. Do not configure a Render cron job, production environment variable, or deployment as part of this engineering-only change.
