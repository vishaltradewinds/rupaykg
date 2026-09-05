# Production PostgreSQL TLS decision

RupayKG production must not weaken PostgreSQL certificate verification to make Cloud SQL connectivity work.

The application currently uses `DATABASE_SSL=require` with PostgreSQL certificate verification enabled. For a direct Cloud SQL private-IP TCP connection, the production runtime must provide the appropriate Cloud SQL server CA trust material to the PostgreSQL client, or the deployment must use a Cloud SQL Language Connector/Auth Proxy path that performs server and client identity verification.

The selected deployment topology must therefore be acceptance-tested against the actual Cloud SQL instance before production sign-off.

## Required evidence

- Actual Cloud SQL instance and region identified.
- Cloud Run and Cloud SQL networking path identified and tested.
- Server CA mode recorded.
- If direct TCP is used, the server CA trust chain is supplied through the deployment secret boundary and verified by the client.
- If Cloud SQL Language Connector/Auth Proxy is used, its identity and network configuration are verified and the application connection contract is explicitly adapted and tested.
- `rejectUnauthorized=false` is not an acceptable production workaround.

This document records a decision gate, not evidence that the target GCP environment has been provisioned or accepted.
