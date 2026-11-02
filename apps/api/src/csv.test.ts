import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv.js";

describe("csv export safety", () => {
  it("prefixes formula-like values", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@sum")).toBe("'@sum");
  });

  it("quotes commas and escapes quotes", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });

  it("builds a csv document", () => {
    expect(toCsv(["a", "b"], [["=1", "ok"]])).toBe("a,b\n'=1,ok\n");
  });
});
