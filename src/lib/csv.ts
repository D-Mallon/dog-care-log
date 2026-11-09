export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

function normalise(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Escape a single CSV field.
 *
 * Strings beginning with a spreadsheet formula character are prefixed with an
 * apostrophe to reduce CSV-injection risk. Numbers are left untouched so
 * negative values remain numeric.
 */
export function escapeCsvField(value: CsvValue): string {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  let text = normalise(value);
  if (text.length > 0 && FORMULA_PREFIXES.includes(text[0])) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function rowsToCsv(rows: CsvValue[][]): string {
  return rows
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n");
}

/** Excel on Windows prefers a UTF-8 BOM; harmless elsewhere. */
export function withUtf8Bom(csv: string): string {
  return `\uFEFF${csv}`;
}

export function downloadCsv(
  filename: string,
  rows: CsvValue[][],
  documentRef: Document = document,
): void {
  const csv = withUtf8Bom(`${rowsToCsv(rows)}\r\n`);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "dog";
}
