# EDI parser — support scope and limitations

**Package:** `@claim-checker/edi-parser`  
**API:** `parse837P(input: string): ParseResult`  
**Product name (UI):** Claim Checker (configurable later)

> Passing unit tests proves the behaviors covered by synthetic fixtures.  
> **It does not mean** Claim Checker is fully compliant with the complete X12 005010X222A1 implementation guide or HIPAA transaction requirements.

## Locked decisions (pre–Milestone 2)

| Decision | Value |
|----------|--------|
| Product name | Claim Checker (working UI name; keep configurable) |
| Upload size | 2 MB via `UPLOAD_MAX_BYTES` (enforced in API milestone) |
| PostgreSQL RLS | API-level organization scoping for now; assess RLS before production |
| Parser scope | X12 **837 Professional**, IG **005010X222A1** only |
| Unsupported files | Reject with actionable errors; never silently reinterpret |
| Fixtures | Synthetic EDI only |

## What is supported (MVP)

- Delimiter detection from **ISA** (element, repetition, component, segment terminator). ISA16 is treated as a single character followed immediately by the segment terminator.
- Envelope checks: **ISA/IEA**, **GS/GE**, **ST/SE** control-number matching; **SE01** segment count (ST through SE inclusive).
- Transaction gate: `ST01 = 837` and `ST03` / `GS08 = 005010X222A1`.
- Multiple **CLM** loops in one ST/SE when present.
- Normalization of:
  - Billing provider (`NM1*85`)
  - Subscriber (`NM1*IL`)
  - Claim header (`CLM`)
  - Diagnoses (`HI` composites)
  - Service lines (`LX` / `SV1` / `DTP*472`)
- **Source locations** on normalized objects (`segmentIndex`, `segmentId`, optional `elementIndex`).

## What is not claimed / not implemented

- Full loop/segment situational rules from the licensed implementation guide
- Institutional 837I, dental, or other IGs (e.g. `005010X223A2`)
- Payer-specific companion guides
- Complete HL hierarchical validation beyond using NM1 contexts for normalization
- All NM1 entity types, COB, ambulance, DME, or other specialty loops
- Binary / non-text EDI or wrapped ISA variants beyond simple leading whitespace/BOM strip

Unsupported or malformed input returns `ok: false` with stable error codes and suggested actions.

## Error codes

| Code | Meaning |
|------|---------|
| `PARSE_EMPTY` | Empty input |
| `PARSE_ISA_MISSING` | No usable ISA/IEA interchange |
| `PARSE_DELIMITER` | Cannot detect delimiters from ISA |
| `PARSE_MALFORMED_SEGMENT` | Empty or invalid segment identifier |
| `PARSE_ENVELOPE_ISA_IEA_MISMATCH` | ISA13 ≠ IEA02 |
| `PARSE_ENVELOPE_GS_GE_MISMATCH` | GS06 ≠ GE02 |
| `PARSE_ENVELOPE_ST_SE_MISMATCH` | ST02 ≠ SE02 |
| `PARSE_ENVELOPE_SE_COUNT` | SE01 ≠ actual ST…SE count |
| `PARSE_UNSUPPORTED_VERSION` | IG ≠ `005010X222A1` |
| `PARSE_UNSUPPORTED_TRANSACTION` | ST01 ≠ `837` |
| `PARSE_MISSING_TRANSACTION` | Missing ST/SE |

## Fixtures

Synthetic files under `fixtures/edi/`:

| File | Intent |
|------|--------|
| `valid-single-claim.edi` | Happy path + expected JSON |
| `valid-multi-claim.edi` | Two claims / subscribers |
| `unsupported-version.edi` | Reject `005010X223A2` |
| `control-number-mismatch.edi` | ISA/IEA mismatch |
| `se-count-mismatch.edi` | Bad SE01 |
| `malformed-no-isa.txt` | Not an interchange |
| `malformed-segment.edi` | Empty segment id |

## Verify

```bash
pnpm --filter @claim-checker/edi-parser test
```
