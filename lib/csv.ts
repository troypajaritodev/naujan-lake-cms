/**
 * Client-side CSV export helper with RFC 4180 quoting and spreadsheet
 * formula-injection neutralization for staff reports.
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (FORMULA_TRIGGER.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): void {
  if (typeof window === "undefined") return;
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
