# WA03.001 Guardian Import Blocker

Checkpoint: guardian-policy-id
Date: 2026-09-22

Verified:
- Guardian-native WA03.001 policy source created.
- BEE BM WA03.001 v1.0 is controlling methodology.
- Equation 4 is implemented in the Guardian custom-logic block.
- Local bundle generated: artifacts/RupayKg-WA03.001-v1.policy
- Local Guardian authentication succeeds for the demo Standard Registry.
- Guardian import endpoint is reachable.

Current blocker:
The local Guardian instance cannot create Hedera-backed credentials because its configured operator credentials are invalid for the configured operator account.

Observed task failure:
transaction 0.0.10123135@1790081900.348857874 failed precheck with status INVALID_SIGNATURE against node account id 0.0.5

Configured operator account: 0.0.10123135

Required resolution:
1. Repair the local Guardian Hedera operator credential pair so the private key corresponds to 0.0.10123135.
2. Restart Guardian.
3. Confirm random-key/DID registration succeeds.
4. Import the WA03.001 policy bundle.
5. Validate and publish it.
6. Capture the real Guardian policy ID.

No policy ID or publication is claimed until live evidence verifies it.
