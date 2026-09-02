export type IntelligenceFinding = {
  kind: "CLASSIFICATION" | "ANOMALY" | "FORECAST";
  confidence: number;
  summary: string;
  sourceRecordIds: string[];
  action: "REVIEW" | "NONE";
};

function confidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("confidence must be between 0 and 1");
  return value;
}

export function classifyMaterial(summary: string, sourceRecordIds: string[], modelConfidence: number): IntelligenceFinding {
  if (!summary.trim() || sourceRecordIds.length === 0) throw new Error("AI classification requires source records");
  return { kind: "CLASSIFICATION", confidence: confidence(modelConfidence), summary, sourceRecordIds, action: "REVIEW" };
}

export function flagMeasurementAnomaly(summary: string, sourceRecordIds: string[], modelConfidence: number): IntelligenceFinding {
  if (!summary.trim() || sourceRecordIds.length === 0) throw new Error("AI anomaly detection requires source records");
  return { kind: "ANOMALY", confidence: confidence(modelConfidence), summary, sourceRecordIds, action: "REVIEW" };
}

export function forecastCarbonYield(summary: string, sourceRecordIds: string[], modelConfidence: number): IntelligenceFinding {
  if (!summary.trim() || sourceRecordIds.length === 0) throw new Error("AI forecasting requires source records");
  return { kind: "FORECAST", confidence: confidence(modelConfidence), summary, sourceRecordIds, action: "REVIEW" };
}

export function canAIMutateAuthoritativeState(): false {
  return false;
}
