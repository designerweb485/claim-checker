import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse837P } from "@claim-checker/edi-parser";
import { describe, expect, it } from "vitest";
import { RULE_SET_VERSION, listRules, validateClaims } from "./index.js";
import { validClaim } from "./test-fixtures.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/edi");

describe("validateClaims", () => {
  it("returns no findings for a valid synthetic claim", () => {
    const result = validateClaims({ claims: [validClaim()] });
    expect(result.ruleSetVersion).toBe(RULE_SET_VERSION);
    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({ error: 0, warning: 0, info: 0 });
  });

  it("accepts parser normalized output from a valid fixture", () => {
    const parsed = parse837P(readFileSync(join(fixtures, "valid-single-claim.edi"), "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = validateClaims(parsed.data);
    expect(result.findings).toEqual([]);
  });

  it("is deterministic for the same input and rule-set version", () => {
    const claim = validClaim({
      totalCharge: "50.00",
      serviceLines: [
        {
          ...validClaim().serviceLines[0]!,
          charge: "100.00",
        },
      ],
    });
    const a = validateClaims({ claims: [claim] });
    const b = validateClaims({ claims: [claim] });
    expect(a).toEqual(b);
    expect(a.findings.some((f) => f.ruleId === "CLM-002")).toBe(true);
  });

  it("emits CLM-001 when required claim fields are missing", () => {
    const result = validateClaims({
      claims: [validClaim({ claimControlNumber: "", totalCharge: undefined })],
    });
    const ids = result.findings.filter((f) => f.ruleId === "CLM-001").map((f) => f.message);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(result.summary.error).toBeGreaterThan(0);
  });

  it("emits PRV-001 for missing or non-10-digit NPI without code-set lookup", () => {
    const missing = validateClaims({
      claims: [validClaim({ billingProvider: undefined })],
    });
    expect(missing.findings.some((f) => f.ruleId === "PRV-001")).toBe(true);

    const badFormat = validateClaims({
      claims: [
        validClaim({
          billingProvider: {
            entityType: "2",
            organizationName: "X",
            npi: "123",
            source: { segmentIndex: 1, segmentId: "NM1", elementIndex: 9 },
          },
        }),
      ],
    });
    expect(badFormat.findings.some((f) => f.ruleId === "PRV-001" && f.message.includes("10-digit"))).toBe(
      true,
    );
  });

  it("emits SUB-001 when member id is missing", () => {
    const result = validateClaims({
      claims: [
        validClaim({
          subscriber: {
            lastName: "DOE",
            firstName: "JANE",
            source: { segmentIndex: 1, segmentId: "NM1" },
          },
        }),
      ],
    });
    expect(result.findings.some((f) => f.ruleId === "SUB-001")).toBe(true);
  });

  it("emits DX-001 and DX-002 for diagnosis issues", () => {
    const noDx = validateClaims({ claims: [validClaim({ diagnoses: [] })] });
    expect(noDx.findings.some((f) => f.ruleId === "DX-001")).toBe(true);

    const badPointer = validateClaims({
      claims: [
        validClaim({
          serviceLines: [
            {
              ...validClaim().serviceLines[0]!,
              diagnosisPointers: [9],
            },
          ],
        }),
      ],
    });
    expect(badPointer.findings.some((f) => f.ruleId === "DX-002")).toBe(true);
  });

  it("emits LIN and DTP findings for service-line problems", () => {
    const result = validateClaims({
      claims: [
        validClaim({
          serviceLines: [
            {
              lineNumber: 1,
              source: { segmentIndex: 1, segmentId: "SV1" },
              diagnosisPointers: [1],
              procedureCode: undefined,
              charge: undefined,
              unitCode: undefined,
              units: undefined,
              serviceDate: "20261399",
            },
          ],
        }),
      ],
    });
    const ids = new Set(result.findings.map((f) => f.ruleId));
    expect(ids.has("LIN-001")).toBe(true);
    expect(ids.has("DTP-001")).toBe(true);
  });

  it("emits multiple findings across rules in one run", () => {
    const result = validateClaims({
      claims: [
        validClaim({
          billingProvider: undefined,
          diagnoses: [],
          totalCharge: "10.00",
        }),
      ],
    });
    expect(result.findings.length).toBeGreaterThan(1);
    expect(new Set(result.findings.map((f) => f.ruleId)).size).toBeGreaterThan(1);
  });

  it("warns on duplicate claim control numbers (CLM-003)", () => {
    const a = validClaim({ claimControlNumber: "DUP-1" });
    const b = validClaim({ claimControlNumber: "DUP-1", totalCharge: "100.00" });
    const result = validateClaims({ claims: [a, b] });
    const dups = result.findings.filter((f) => f.ruleId === "CLM-003");
    expect(dups).toHaveLength(1);
    expect(dups[0]?.severity).toBe("warning");
    expect(result.summary.warning).toBeGreaterThanOrEqual(1);
  });

  it("exposes a stable registry of rules with documentation metadata", () => {
    const rules = listRules();
    expect(rules.map((r) => r.id)).toEqual([
      "CLM-001",
      "PRV-001",
      "SUB-001",
      "DX-001",
      "DX-002",
      "LIN-001",
      "LIN-002",
      "DTP-001",
      "CLM-002",
      "CLM-003",
    ]);
    for (const rule of rules) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
      expect(rule.applicability.length).toBeGreaterThan(0);
      expect(rule.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("does not invent ICD/CPT invalidity from pattern checks alone", () => {
    // Odd-looking but present codes must not trigger a fabricated "invalid code" rule
    const result = validateClaims({
      claims: [
        validClaim({
          diagnoses: [
            { sequence: 1, code: "ZZZZZ", codeSet: "ABK", source: { segmentIndex: 1, segmentId: "HI" } },
          ],
          serviceLines: [
            {
              ...validClaim().serviceLines[0]!,
              procedureCode: "99999",
              diagnosisPointers: [1],
            },
          ],
        }),
      ],
    });
    expect(result.findings.every((f) => !/invalid (diagnosis|procedure) code/i.test(f.message))).toBe(
      true,
    );
  });
});
