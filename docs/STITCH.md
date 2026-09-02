# Google Stitch UI/UX Plan

Use Google Stitch for high-fidelity exploration and interactive prototypes. The generated UI is a presentation layer over the RupayKg API and must consume backend status rather than inventing it.

## Priority screens

### 1. National Command Center
Purpose: India-wide operational overview.
Show geography, material throughput, active facilities, MRV queues, compliance workload and alerts. Every metric exposes provenance/status.

### 2. ULB Operations
Purpose: ward-level collection and resource-flow operations.
Show collection tasks, route progress, measurement events, exceptions, transfer/MRF queues and evidence completeness.

### 3. Rural Operations
Purpose: Gram Panchayat/cluster workflows.
Show village aggregation, offline-synced field tasks, weighing, transport, local processing and pending evidence.

### 4. Field Capture Mobile
Purpose: fast, low-bandwidth field work.
Flow: task -> identity/location -> material -> quantity -> evidence -> submit -> sync status.

### 5. MRV Workspace
Purpose: review evidence and verification decisions.
Show source activity, measurements, evidence gallery, chain of custody, verifier checklist and decision history.

### 6. EPR Workspace
Purpose: obligations, eligible evidence, recycler records, submissions and authority responses.

### 7. Carbon Workspace
Purpose: methodology selection, project facts, calculation inputs, results, review and approval.

### 8. Registry Workspace
Purpose: credential issuance, ownership, transfer and retirement with external registry references.

### 9. Settlement Workspace
Purpose: eligible amounts, authorization, execution, reconciliation and settled/failed outcomes.

### 10. Audit Explorer
Purpose: reconstruct who changed what, when and why.

## Stitch prompt rules
Every prompt should include:
- India-wide urban + rural context
- institutional/government-grade design
- accessible typography and contrast
- responsive desktop/mobile behavior
- explicit VERIFIED/PENDING/REJECTED/UNAVAILABLE/DEMO/SIMULATED labels
- evidence and audit visibility for regulated actions
- no invented live metrics

Do not expose credentials, secrets or private integration keys to Stitch prompts.
