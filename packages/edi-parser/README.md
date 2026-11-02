# `@claim-checker/edi-parser`

Parses **synthetic** X12 **837 Professional** interchanges for IG **`005010X222A1`**.

```ts
import { parse837P } from "@claim-checker/edi-parser";

const result = parse837P(fileContents);
if (result.ok) {
  console.log(result.data.claims);
} else {
  console.error(result.errors);
}
```

## Docs

- Support matrix and honesty boundaries: [`docs/parser.md`](../../docs/parser.md)
- Architecture: [`docs/architecture.md`](../../docs/architecture.md)

## Tests

```bash
pnpm --filter @claim-checker/edi-parser test
```

Not an X12/HIPAA certification product. Passing tests ≠ full IG conformance.
