/**
 * Legacy synthetic acceptance seeder is intentionally disabled.
 *
 * Synthetic measurements/evidence must not be submitted through authoritative
 * MRV or used to claim Guardian/Hedera production acceptance. The live
 * acceptance workflow requires a real completed activity, approved
 * verification, verified evidence, and explicitly instrument-bound readings.
 *
 * Offline synthetic cases belong in unit tests and must remain registry-ineligible.
 */
if (process.env.RUPAYKG_ACCEPTANCE_SEED_ON_START === "true") {
  throw new Error(
    "Synthetic acceptance seeding is disabled for authoritative MRV. Use a real, independently verified activity for Guardian/Hedera live acceptance; synthetic fixtures must remain offline and registry-ineligible.",
  );
}
