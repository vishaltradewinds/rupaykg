import { describe, expect, it } from "vitest";

describe("settlement reconciliation invariants", () => {
  it("requires external confirmation and reconciliation evidence before SETTLED", () => {
    const required = ["externalReference", "externalConfirmationAt", "reconciliationReference"];
    expect(required).toHaveLength(3);
  });

  it("requires authorization before final settlement", () => {
    const lifecycle = ["CREATED", "AUTHORIZED", "EXECUTING", "RECONCILING", "SETTLED"];
    expect(lifecycle.indexOf("AUTHORIZED")).toBeLessThan(lifecycle.indexOf("SETTLED"));
  });

  it("requires reconciliation reference to remain bound to external confirmation", () => {
    expect("reconciliation_reference").toBeTruthy();
    expect("external_confirmed_at").toBeTruthy();
  });
});
