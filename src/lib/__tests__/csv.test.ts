import { describe, expect, it } from "vitest";
import {
  escapeCsvField,
  rowsToCsv,
  safeFilename,
  withUtf8Bom,
} from "../csv.ts";

describe("CSV escaping", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvField("Bear, K")).toBe('"Bear, K"');
    expect(escapeCsvField('Bear "K"')).toBe('"Bear ""K"""');
    expect(escapeCsvField("line one\nline two")).toBe(
      '"line one\nline two"',
    );
  });

  it("prevents spreadsheet formula injection for strings", () => {
    expect(escapeCsvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvField("+44 123")).toBe("'+44 123");
    expect(escapeCsvField("-please")).toBe("'-please");
    expect(escapeCsvField("@handle")).toBe("'@handle");
  });

  it("leaves numbers and booleans numeric", () => {
    expect(escapeCsvField(-3.5)).toBe("-3.5");
    expect(escapeCsvField(true)).toBe("true");
  });

  it("joins rows with CRLF", () => {
    expect(
      rowsToCsv([
        ["name", "note"],
        ["Bear", "a,b"],
      ]),
    ).toBe('name,note\r\nBear,"a,b"');
  });

  it("adds a UTF-8 BOM for Excel", () => {
    expect(withUtf8Bom("a,b")).toBe("\uFEFFa,b");
  });

  it("creates safe filenames", () => {
    expect(safeFilename("Bear K / 2")).toBe("Bear_K_2");
    expect(safeFilename("   ")).toBe("dog");
  });
});
