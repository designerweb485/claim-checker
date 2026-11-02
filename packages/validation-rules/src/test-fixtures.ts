import type { NormalizedClaim, SourceLocation } from "@claim-checker/edi-parser";

const loc = (segmentIndex: number, segmentId: string, elementIndex?: number): SourceLocation => ({
  segmentIndex,
  segmentId,
  elementIndex,
});

/** Synthetic valid professional claim for unit tests. */
export function validClaim(overrides: Partial<NormalizedClaim> = {}): NormalizedClaim {
  return {
    claimControlNumber: "CLM-DEMO-1001",
    totalCharge: "100.00",
    placeOfServiceCode: "11",
    billingProvider: {
      entityType: "2",
      organizationName: "DEMO BILLING CLINIC",
      npi: "1999999999",
      source: loc(8, "NM1", 9),
    },
    subscriber: {
      memberId: "MEM000042",
      lastName: "DOE",
      firstName: "JANE",
      source: loc(14, "NM1", 9),
    },
    diagnoses: [{ sequence: 1, code: "M545", codeSet: "ABK", source: loc(20, "HI", 1) }],
    serviceLines: [
      {
        lineNumber: 1,
        procedureCode: "99213",
        procedureCodeQualifier: "HC",
        charge: "100.00",
        unitCode: "UN",
        units: "1",
        diagnosisPointers: [1],
        serviceDate: "20261001",
        source: loc(22, "SV1", 1),
      },
    ],
    source: loc(19, "CLM", 1),
    ...overrides,
  };
}
