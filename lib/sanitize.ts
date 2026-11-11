/**
 * Input cleaning for the demo stores (Milestone 4 — baseline hardening).
 *
 * React escapes everything it renders, so this is not an XSS boundary. It is
 * storage hygiene: strip control characters, normalise line endings and cap
 * field lengths before a record is persisted or compared.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value: string, maxLength = 2000): string {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function cleanEmail(value: string): string {
  return cleanText(value, 254).toLowerCase();
}

export function cleanPhone(value: string): string {
  return cleanText(value, 32);
}
