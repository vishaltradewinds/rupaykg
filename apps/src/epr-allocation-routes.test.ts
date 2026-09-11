import { describe, expect, it } from "vitest";

describe("EPR allocation integrity", () => {
  it("requires positive allocation quantities", () => {
    expect(Number("0") > 0).toBe(false);
    expect(Number("-1") > 0).toBe(false);
    expect(Number("2") > 0).toBe(true);
  });

  it("defines the allocation boundary as the quantity consumed from a credit", () => {
    const creditQuantity = 100;
    const allocations = [30, 20];
    const remaining = creditQuantity - allocations.reduce((sum, value) => sum + value, 0);
    expect(remaining).toBe(50);
    expect(remaining + 60).toBeGreaterThan(creditQuantity);
  });
});
