# RupayKg Guardian Policy — BM WA03.001

This bundle is an implementation build artifact, not yet published.

Controlling methodology: BEE BM WA03.001 v1.0.
Equation 4: (FCH4,PJ,y − FCH4,BL,y) × 29.8 × (1 − OX) − PEy − LEy.

The monitoring workflow requires a prior baseline document with matching activity ID, baseline record ID, FCH4,BL,y and baseline SHA-256. This is a cross-document consistency gate only. It does not prove that the baseline record is approved in RupayKg or that BM-T-011 evidence is sufficient; a trusted signed RupayKg credential/bridge and verifier acceptance are still required.

The bundle deliberately does not contain fabricated Guardian IDs, Hedera message IDs, signatures, or publication evidence. Guardian must validate/import it before it becomes a real policy instance.
