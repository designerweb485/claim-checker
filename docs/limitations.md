# Known limitations

- This product is an **MVP for synthetic EDI demos**. It is **not** HIPAA compliant by certification and is **not** an X12 implementation-guide conformance product.
- Claim parsing support is **837 Professional `005010X222A1` only**. Other transactions and versions are **rejected** with actionable errors (never silently treated as supported).
- Parser unit tests cover synthetic fixtures only. **Passing parser tests is not full implementation-guide compliance.** Details: [`docs/parser.md`](parser.md).
- Validation rules are structural/consistency checks only — **not** payer-ready and **not** a denial guarantee. See [`docs/validation-rules.md`](validation-rules.md).
- Diagnosis/procedure **code-set** validity is not enforced without versioned reference data (no simplistic “invalid code” pattern rules).
- Payer-specific companion-guide rules remain out of MVP scope.
- Upload processing will be synchronous with a **2 MB** default file-size cap (`UPLOAD_MAX_BYTES`); high volume needs a queue (later).
- Organization isolation is enforced at the **API** layer for now; Postgres RLS to be assessed before production.
- Optional AI explanations are non-authoritative and may be unavailable.
- Use **synthetic fixtures only** — never real patient data in demos or tests.
