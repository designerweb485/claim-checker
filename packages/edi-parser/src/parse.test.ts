import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse837P, SUPPORTED_IG } from "./index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtures = join(root, "fixtures", "edi");

function load(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

describe("parse837P", () => {
  it("parses a valid single-claim 837P and preserves source locations", () => {
    const result = parse837P(load("valid-single-claim.edi"));
    const expected = JSON.parse(
      readFileSync(join(fixtures, "expected", "valid-single-claim.json"), "utf8"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.implementationGuide).toBe(SUPPORTED_IG);
    expect(result.data.delimiters).toEqual(expected.delimiters);
    expect(result.data.interchangeControlNumber).toBe(expected.interchangeControlNumber);
    expect(result.data.claims).toHaveLength(1);
    expect(result.data.claims[0]).toMatchObject(expected.claims[0]);
  });

  it("parses multiple claims in one transaction", () => {
    const result = parse837P(load("valid-multi-claim.edi"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.claims.map((c) => c.claimControlNumber)).toEqual([
      "CLM-DEMO-2001",
      "CLM-DEMO-2002",
    ]);
    expect(result.data.claims[0]?.subscriber?.memberId).toBe("MEM000042");
    expect(result.data.claims[1]?.subscriber?.memberId).toBe("MEM000099");
    expect(result.data.claims[0]?.billingProvider?.npi).toBe("1999999999");
    expect(result.data.claims[1]?.billingProvider?.npi).toBe("1999999999");
  });

  it("rejects unsupported implementation guide versions with an actionable error", () => {
    const result = parse837P(load("unsupported-version.edi"));
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.some((e) => e.code === "PARSE_UNSUPPORTED_VERSION")).toBe(true);
    const err = result.errors.find((e) => e.code === "PARSE_UNSUPPORTED_VERSION");
    expect(err?.message).toMatch(/005010X223A2/);
    expect(err?.suggestedAction.length).toBeGreaterThan(10);
  });

  it("rejects ISA/IEA control number mismatches", () => {
    const result = parse837P(load("control-number-mismatch.edi"));
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.some((e) => e.code === "PARSE_ENVELOPE_ISA_IEA_MISMATCH")).toBe(true);
  });

  it("rejects incorrect SE segment counts", () => {
    const result = parse837P(load("se-count-mismatch.edi"));
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.some((e) => e.code === "PARSE_ENVELOPE_SE_COUNT")).toBe(true);
  });

  it("rejects input that is not an X12 interchange", () => {
    const result = parse837P(load("malformed-no-isa.txt"));
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.some((e) => e.code === "PARSE_ISA_MISSING")).toBe(true);
  });

  it("rejects malformed empty segments safely", () => {
    const result = parse837P(load("malformed-segment.edi"));
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.some((e) => e.code === "PARSE_MALFORMED_SEGMENT")).toBe(true);
  });

  it("rejects empty input", () => {
    const result = parse837P("   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe("PARSE_EMPTY");
  });

  it("detects non-default delimiters from ISA", () => {
    const custom = [
      "ISA|00|          |00|          |ZZ|SENDERID       |ZZ|RECEIVERID     |261028|1200|^|00501|000000910|0|T|!~",
      "GS|HC|SENDERID|RECEIVERID|20261028|1200|10|X|005010X222A1~",
      "ST|837|0010|005010X222A1~",
      "BHT|0019|00|DEMO|20261028|1200|CH~",
      "NM1|41|2|DEMO SUBMITTER|||||46|SUB1~",
      "HL|1||20|1~",
      "NM1|85|2|DEMO BILLING CLINIC|||||XX|1999999999~",
      "HL|2|1|22|0~",
      "SBR|P|18|||||||CI~",
      "NM1|IL|1|DOE|JANE||||MI|MEM000042~",
      "NM1|PR|2|DEMO PAYER|||||PI|DEMOPAYER~",
      "CLM|CLM-DEMO-9101|10.00|||11!B!1|Y|A|Y|Y~",
      "HI|ABK!M545~",
      "LX|1~",
      "SV1|HC!99213|10.00|UN|1|||1~",
      "SE|14|0010~",
      "GE|1|10~",
      "IEA|1|000000910~",
    ].join("");

    const result = parse837P(custom);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.delimiters).toEqual({
      element: "|",
      component: "!",
      segment: "~",
      repetition: "^",
    });
    expect(result.data.claims[0]?.claimControlNumber).toBe("CLM-DEMO-9101");
    expect(result.data.claims[0]?.diagnoses[0]?.code).toBe("M545");
  });
});
