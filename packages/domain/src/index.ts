export * from "./state-machines.js";
export * from "./regulatory.js";
export * from "./resource-flows.js";
export * from "./field-operations.js";

export const STATUS = {
  VERIFIED: "VERIFIED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
  UNAVAILABLE: "UNAVAILABLE",
  DEMO: "DEMO",
  SIMULATED: "SIMULATED",
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];
