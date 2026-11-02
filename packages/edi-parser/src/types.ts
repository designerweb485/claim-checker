/** Source location for findings / diagnostics (0-based segment index). */
export type SourceLocation = {
  segmentIndex: number;
  segmentId: string;
  /** 1-based X12 element position when applicable */
  elementIndex?: number;
};

export type Delimiters = {
  element: string;
  component: string;
  segment: string;
  repetition: string;
};

export type ParseErrorCode =
  | "PARSE_EMPTY"
  | "PARSE_ISA_MISSING"
  | "PARSE_DELIMITER"
  | "PARSE_MALFORMED_SEGMENT"
  | "PARSE_ENVELOPE_ISA_IEA_MISMATCH"
  | "PARSE_ENVELOPE_GS_GE_MISMATCH"
  | "PARSE_ENVELOPE_ST_SE_MISMATCH"
  | "PARSE_ENVELOPE_SE_COUNT"
  | "PARSE_UNSUPPORTED_VERSION"
  | "PARSE_UNSUPPORTED_TRANSACTION"
  | "PARSE_MISSING_TRANSACTION";

export type ParseError = {
  code: ParseErrorCode;
  message: string;
  suggestedAction: string;
  location?: SourceLocation;
};

export type Provider = {
  entityType: string;
  organizationName?: string;
  lastName?: string;
  firstName?: string;
  npi?: string;
  source: SourceLocation;
};

export type Subscriber = {
  memberId?: string;
  lastName?: string;
  firstName?: string;
  source: SourceLocation;
};

export type Diagnosis = {
  sequence: number;
  code: string;
  codeSet: string;
  source: SourceLocation;
};

export type ServiceLine = {
  lineNumber: number;
  procedureCode?: string;
  procedureCodeQualifier?: string;
  modifiers?: string[];
  charge?: string;
  unitCode?: string;
  units?: string;
  diagnosisPointers: number[];
  serviceDate?: string;
  source: SourceLocation;
};

export type NormalizedClaim = {
  claimControlNumber: string;
  totalCharge?: string;
  placeOfServiceCode?: string;
  billingProvider?: Provider;
  subscriber?: Subscriber;
  diagnoses: Diagnosis[];
  serviceLines: ServiceLine[];
  source: SourceLocation;
};

export type ParsedInterchange = {
  delimiters: Delimiters;
  interchangeControlNumber: string;
  groupControlNumber: string;
  transactionControlNumber: string;
  transactionSetCode: string;
  implementationGuide: string;
  claims: NormalizedClaim[];
};

export type ParseSuccess = { ok: true; data: ParsedInterchange };
export type ParseFailure = { ok: false; errors: ParseError[] };
export type ParseResult = ParseSuccess | ParseFailure;
