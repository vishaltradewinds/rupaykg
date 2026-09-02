# EPR Compliance

EPR workflows connect obligated entities with eligible collection/recycling/processing evidence.

Core entities:
- obligation
- obligated organization
- material/category
- compliance period and jurisdiction
- eligible activity
- evidence package
- authorized recycler/processor
- verifier/reviewer
- submission

Compliance status is derived from persisted obligation rules, eligible evidence and approval decisions. The UI must never default an obligation to compliant.

Integration with government or regulator systems must retain the external reference and response state. If the external authority is unavailable, the record remains explicitly unavailable/pending rather than being marked successful.
