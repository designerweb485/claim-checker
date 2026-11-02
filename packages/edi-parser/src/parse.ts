import { SUPPORTED_IG, SUPPORTED_TRANSACTION_SET } from "./constants.js";
import type {
  Delimiters,
  Diagnosis,
  NormalizedClaim,
  ParseError,
  ParseResult,
  Provider,
  ServiceLine,
  SourceLocation,
  Subscriber,
} from "./types.js";

type Segment = {
  id: string;
  elements: string[]; // index 0 = segment id
  index: number;
  location: SourceLocation;
};

function fail(errors: ParseError[]): ParseResult {
  return { ok: false, errors };
}

function error(
  code: ParseError["code"],
  message: string,
  suggestedAction: string,
  location?: SourceLocation,
): ParseError {
  return { code, message, suggestedAction, location };
}

function detectDelimiters(raw: string): { delimiters: Delimiters } | { errors: ParseError[] } {
  if (!raw.startsWith("ISA") || raw.length < 5) {
    return {
      errors: [
        error(
          "PARSE_ISA_MISSING",
          "Input does not begin with an ISA interchange header.",
          "Provide a complete X12 interchange starting with ISA, or check the file encoding and contents.",
        ),
      ],
    };
  }

  const element = raw[3]!;
  if (!element) {
    return {
      errors: [
        error(
          "PARSE_DELIMITER",
          "Could not detect the data element separator from ISA.",
          "Ensure the ISA segment uses a valid element separator in position 4.",
        ),
      ],
    };
  }

  // ISA01–ISA15 are element-separator terminated; ISA16 is one character,
  // then the segment terminator follows immediately (no trailing element sep).
  const elements: string[] = [];
  let pos = 4;
  while (elements.length < 15 && pos < raw.length) {
    const end = raw.indexOf(element, pos);
    if (end === -1) {
      return {
        errors: [
          error(
            "PARSE_DELIMITER",
            "ISA header is truncated before ISA15.",
            "Repair the ISA segment so ISA01–ISA15 are present, then ISA16 and the segment terminator.",
          ),
        ],
      };
    }
    elements.push(raw.slice(pos, end));
    pos = end + 1;
  }

  if (elements.length < 15 || pos >= raw.length) {
    return {
      errors: [
        error(
          "PARSE_DELIMITER",
          "ISA header is incomplete (expected ISA01–ISA16 and a segment terminator).",
          "Repair the ISA segment so it defines element, repetition, component, and segment delimiters.",
        ),
      ],
    };
  }

  const component = raw[pos]!;
  pos += 1;
  if (pos >= raw.length) {
    return {
      errors: [
        error(
          "PARSE_DELIMITER",
          "Missing segment terminator after ISA16.",
          "Add the segment terminator character immediately after the ISA component element separator.",
        ),
      ],
    };
  }

  const segment = raw[pos]!;
  const repetition = elements[10] ?? "";

  if (!component || !segment) {
    return {
      errors: [
        error(
          "PARSE_DELIMITER",
          "Invalid component separator or segment terminator in ISA.",
          "Verify ISA11 (repetition), ISA16 (component), and the character following ISA16 (segment terminator).",
        ),
      ],
    };
  }

  return {
    delimiters: { element, component, segment, repetition },
  };
}

function tokenize(raw: string, delimiters: Delimiters): { segments: Segment[] } | { errors: ParseError[] } {
  const parts = raw.split(delimiters.segment);
  const segments: Segment[] = [];
  const errors: ParseError[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part.length === 0) continue;
    // Ignore trailing whitespace-only chunks
    if (part.trim().length === 0) continue;

    const elements = part.split(delimiters.element);
    const id = (elements[0] ?? "").trim();
    if (!id) {
      errors.push(
        error(
          "PARSE_MALFORMED_SEGMENT",
          `Segment at index ${segments.length} has an empty segment identifier.`,
          "Remove empty segments and ensure each segment begins with a valid identifier (for example ST, CLM, SV1).",
          { segmentIndex: segments.length, segmentId: "" },
        ),
      );
      continue;
    }

    segments.push({
      id,
      elements,
      index: segments.length,
      location: { segmentIndex: segments.length, segmentId: id },
    });
  }

  if (errors.length > 0) return { errors };
  return { segments };
}

function el(seg: Segment, n: number): string {
  return seg.elements[n] ?? "";
}

function validateEnvelope(segments: Segment[]): ParseError[] {
  const errors: ParseError[] = [];
  const isa = segments.find((s) => s.id === "ISA");
  const iea = segments.find((s) => s.id === "IEA");
  const gs = segments.find((s) => s.id === "GS");
  const ge = segments.find((s) => s.id === "GE");
  const st = segments.find((s) => s.id === "ST");
  const se = segments.find((s) => s.id === "SE");

  if (!isa || !iea) {
    errors.push(
      error(
        "PARSE_ISA_MISSING",
        "Interchange is missing ISA and/or IEA segments.",
        "Include matching ISA and IEA envelope segments.",
      ),
    );
    return errors;
  }

  const isaCtrl = el(isa, 13).trim();
  const ieaCtrl = el(iea, 2).trim();
  if (isaCtrl !== ieaCtrl) {
    errors.push(
      error(
        "PARSE_ENVELOPE_ISA_IEA_MISMATCH",
        `ISA control number "${isaCtrl}" does not match IEA control number "${ieaCtrl}".`,
        "Set IEA02 equal to ISA13 (interchange control number).",
        iea.location,
      ),
    );
  }

  if (gs && ge) {
    const gsCtrl = el(gs, 6).trim();
    const geCtrl = el(ge, 2).trim();
    if (gsCtrl !== geCtrl) {
      errors.push(
        error(
          "PARSE_ENVELOPE_GS_GE_MISMATCH",
          `GS control number "${gsCtrl}" does not match GE control number "${geCtrl}".`,
          "Set GE02 equal to GS06 (group control number).",
          ge.location,
        ),
      );
    }
  }

  if (!st || !se) {
    errors.push(
      error(
        "PARSE_MISSING_TRANSACTION",
        "Transaction set is missing ST and/or SE segments.",
        "Include an ST/SE pair for the 837 transaction.",
      ),
    );
    return errors;
  }

  const stCtrl = el(st, 2).trim();
  const seCtrl = el(se, 2).trim();
  if (stCtrl !== seCtrl) {
    errors.push(
      error(
        "PARSE_ENVELOPE_ST_SE_MISMATCH",
        `ST control number "${stCtrl}" does not match SE control number "${seCtrl}".`,
        "Set SE02 equal to ST02 (transaction set control number).",
        se.location,
      ),
    );
  }

  const declared = Number.parseInt(el(se, 1).trim(), 10);
  const stIndex = st.index;
  const seIndex = se.index;
  const actual = seIndex - stIndex + 1;
  if (!Number.isFinite(declared) || declared !== actual) {
    errors.push(
      error(
        "PARSE_ENVELOPE_SE_COUNT",
        `SE segment count ${el(se, 1).trim() || "(empty)"} does not match actual count ${actual}.`,
        "Set SE01 to the number of segments from ST through SE inclusive.",
        { ...se.location, elementIndex: 1 },
      ),
    );
  }

  return errors;
}

function validateVersion(segments: Segment[]): ParseError[] {
  const errors: ParseError[] = [];
  const st = segments.find((s) => s.id === "ST");
  const gs = segments.find((s) => s.id === "GS");
  if (!st) return errors;

  const txn = el(st, 1).trim();
  if (txn !== SUPPORTED_TRANSACTION_SET) {
    errors.push(
      error(
        "PARSE_UNSUPPORTED_TRANSACTION",
        `Unsupported transaction set "${txn || "(empty)"}". Only ${SUPPORTED_TRANSACTION_SET} Professional is supported.`,
        `Submit an X12 ${SUPPORTED_TRANSACTION_SET} Professional claim using implementation guide ${SUPPORTED_IG}.`,
        { ...st.location, elementIndex: 1 },
      ),
    );
  }

  const stIg = el(st, 3).trim();
  const gsIg = gs ? el(gs, 8).trim() : "";
  const ig = stIg || gsIg;
  if (ig !== SUPPORTED_IG) {
    errors.push(
      error(
        "PARSE_UNSUPPORTED_VERSION",
        `Unsupported implementation guide "${ig || "(empty)"}". Only ${SUPPORTED_IG} is supported.`,
        `Resubmit using GS08/ST03 value ${SUPPORTED_IG} (837 Professional). Other guides are not interpreted as supported.`,
        { ...st.location, elementIndex: 3 },
      ),
    );
  }

  return errors;
}

function splitComposite(value: string, component: string): string[] {
  return value.length === 0 ? [] : value.split(component);
}

function parseDiagnoses(seg: Segment, component: string): Diagnosis[] {
  const diagnoses: Diagnosis[] = [];
  let sequence = 1;
  for (let i = 1; i < seg.elements.length; i++) {
    const parts = splitComposite(el(seg, i), component);
    const codeSet = parts[0] ?? "";
    const code = (parts[1] ?? "").replace(/\./g, "");
    if (!codeSet || !code) continue;
    diagnoses.push({
      sequence: sequence++,
      code,
      codeSet,
      source: { ...seg.location, elementIndex: i },
    });
  }
  return diagnoses;
}

function parseServiceLine(
  lx: Segment,
  sv1: Segment | undefined,
  dtp: Segment | undefined,
  component: string,
): ServiceLine {
  const lineNumber = Number.parseInt(el(lx, 1).trim(), 10) || 1;
  const procParts = splitComposite(el(sv1 ?? lx, 1), component);
  const pointersRaw = splitComposite(el(sv1 ?? lx, 7), component);
  const diagnosisPointers = pointersRaw
    .map((p) => Number.parseInt(p, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    lineNumber,
    procedureCodeQualifier: procParts[0] || undefined,
    procedureCode: procParts[1] || undefined,
    modifiers: procParts.slice(2).filter(Boolean),
    charge: sv1 ? el(sv1, 2) || undefined : undefined,
    unitCode: sv1 ? el(sv1, 3) || undefined : undefined,
    units: sv1 ? el(sv1, 4) || undefined : undefined,
    diagnosisPointers,
    serviceDate: dtp && el(dtp, 1) === "472" ? el(dtp, 3) || undefined : undefined,
    source: { ...(sv1 ?? lx).location, elementIndex: 1 },
  };
}

function normalizeClaims(segments: Segment[], delimiters: Delimiters): NormalizedClaim[] {
  let billingProvider: Provider | undefined;
  let subscriber: Subscriber | undefined;
  const claims: NormalizedClaim[] = [];

  let current: NormalizedClaim | undefined;
  let pendingLx: Segment | undefined;

  const finishLine = (sv1?: Segment, dtp?: Segment) => {
    if (!current || !pendingLx) return;
    current.serviceLines.push(parseServiceLine(pendingLx, sv1, dtp, delimiters.component));
    pendingLx = undefined;
  };

  for (const seg of segments) {
    if (seg.id === "NM1") {
      const qualifier = el(seg, 1);
      if (qualifier === "85") {
        billingProvider = {
          entityType: el(seg, 2),
          organizationName: el(seg, 2) === "2" ? el(seg, 3) || undefined : undefined,
          lastName: el(seg, 2) === "1" ? el(seg, 3) || undefined : undefined,
          firstName: el(seg, 2) === "1" ? el(seg, 4) || undefined : undefined,
          npi: el(seg, 8) === "XX" ? el(seg, 9) || undefined : el(seg, 9) || undefined,
          source: { ...seg.location, elementIndex: 9 },
        };
      } else if (qualifier === "IL") {
        subscriber = {
          lastName: el(seg, 3) || undefined,
          firstName: el(seg, 4) || undefined,
          memberId: el(seg, 8) === "MI" ? el(seg, 9) || undefined : el(seg, 9) || undefined,
          source: { ...seg.location, elementIndex: 9 },
        };
      }
      continue;
    }

    if (seg.id === "CLM") {
      finishLine();
      const facility = splitComposite(el(seg, 5), delimiters.component);
      current = {
        claimControlNumber: el(seg, 1),
        totalCharge: el(seg, 2) || undefined,
        placeOfServiceCode: facility[0] || undefined,
        billingProvider,
        subscriber,
        diagnoses: [],
        serviceLines: [],
        source: { ...seg.location, elementIndex: 1 },
      };
      claims.push(current);
      continue;
    }

    if (!current) continue;

    if (seg.id === "HI") {
      current.diagnoses.push(...parseDiagnoses(seg, delimiters.component));
      continue;
    }

    if (seg.id === "LX") {
      finishLine();
      pendingLx = seg;
      continue;
    }

    if (seg.id === "SV1" && pendingLx) {
      // Look ahead handled by storing; DTP may follow
      const dtp = undefined;
      finishLine(seg, dtp);
      // Re-open if DTP comes next — better: keep last SV1
      continue;
    }

    if (seg.id === "DTP" && el(seg, 1) === "472") {
      const last = current.serviceLines[current.serviceLines.length - 1];
      if (last && !last.serviceDate) {
        last.serviceDate = el(seg, 3) || undefined;
      }
    }
  }

  finishLine();
  return claims;
}

/**
 * Parse a synthetic X12 837 Professional interchange (005010X222A1 only).
 * Not a full implementation-guide conformance suite — see docs/parser.md.
 */
export function parse837P(input: string): ParseResult {
  const raw = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trimStart();
  if (raw.trim().length === 0) {
    return fail([
      error(
        "PARSE_EMPTY",
        "Input is empty.",
        "Upload a non-empty X12 837 Professional file (.837, .edi, or .txt).",
      ),
    ]);
  }

  const delimResult = detectDelimiters(raw);
  if ("errors" in delimResult) return fail(delimResult.errors);

  const { delimiters } = delimResult;
  const tokenResult = tokenize(raw, delimiters);
  if ("errors" in tokenResult) return fail(tokenResult.errors);

  const { segments } = tokenResult;
  const envelopeErrors = validateEnvelope(segments);
  if (envelopeErrors.length > 0) return fail(envelopeErrors);

  const versionErrors = validateVersion(segments);
  if (versionErrors.length > 0) return fail(versionErrors);

  const isa = segments.find((s) => s.id === "ISA")!;
  const gs = segments.find((s) => s.id === "GS")!;
  const st = segments.find((s) => s.id === "ST")!;

  const claims = normalizeClaims(segments, delimiters);

  return {
    ok: true,
    data: {
      delimiters,
      interchangeControlNumber: el(isa, 13).trim(),
      groupControlNumber: el(gs, 6).trim(),
      transactionControlNumber: el(st, 2).trim(),
      transactionSetCode: el(st, 1).trim(),
      implementationGuide: el(st, 3).trim() || el(gs, 8).trim(),
      claims,
    },
  };
}
