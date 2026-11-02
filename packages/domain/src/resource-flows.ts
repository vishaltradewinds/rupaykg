export type ResourceOrigin = "MUNICIPAL" | "AGRICULTURAL" | "INDUSTRIAL" | "COMMERCIAL" | "HOUSEHOLD";
export type ResourceForm = "WASTE" | "BIOMASS" | "RECYCLABLE" | "ORGANIC" | "RESIDUAL" | "BYPRODUCT";

export interface ResourceFlow {
  id: string;
  origin: ResourceOrigin;
  form: ResourceForm;
  materialCode: string;
  quantity: number;
  unit: string;
  sourceGeographyId: string;
  destinationOrganizationId?: string;
  activityId: string;
}

export interface ChainOfCustodyLink {
  fromActivityId: string;
  toActivityId: string;
  evidenceId?: string;
  recordedAt: string;
}

export function assertPositiveQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Resource quantity must be a finite positive number");
  }
}

export function assertEvidenceBeforeValue(
  evidenceVerified: boolean,
  verificationApproved: boolean,
): void {
  if (!evidenceVerified || !verificationApproved) {
    throw new Error("Value realization requires verified evidence and approved verification");
  }
}
