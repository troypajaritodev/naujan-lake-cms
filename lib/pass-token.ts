import { signHmacJson, verifyHmacJson } from "@/lib/session-token";

const PASS_TOKEN_DOMAIN = "qr-pass";
const PASS_TTL_SECONDS = 60 * 60 * 24 * 365;

export type PassTokenStatus = "ON_PROCESS" | "CONFIRMED" | "COMPLETED";

export type PassTokenPayload = {
  ref: string;
  guest: string;
  tour: string;
  date: string;
  guests: number;
  pay: string;
  status: PassTokenStatus;
  iat: number;
  exp: number;
};

const VALID_PASS_STATUSES = new Set<string>([
  "ON_PROCESS",
  "CONFIRMED",
  "COMPLETED",
]);

/** Sign a server-verified boarding pass payload for QR code verification. */
export async function signPassToken(
  input: Omit<PassTokenPayload, "iat" | "exp">,
): Promise<string> {
  if (!input.ref.trim() || !input.guest.trim() || !input.tour.trim() || !input.date.trim()) {
    throw new Error("Incomplete boarding pass details cannot be signed.");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: PassTokenPayload = {
    ref: input.ref.trim().toUpperCase(),
    guest: input.guest.trim(),
    tour: input.tour.trim(),
    date: input.date.trim(),
    guests: Math.max(1, Math.floor(input.guests)),
    pay: input.pay.trim(),
    status: input.status,
    iat: now,
    exp: now + PASS_TTL_SECONDS,
  };
  return signHmacJson(payload, PASS_TOKEN_DOMAIN);
}

/** Verify an HMAC-signed QR boarding pass token and return its payload if valid. */
export async function verifyPassToken(
  token: string | undefined | null,
): Promise<PassTokenPayload | null> {
  const parsed = (await verifyHmacJson(
    token,
    PASS_TOKEN_DOMAIN,
  )) as Partial<PassTokenPayload> | null;
  if (!parsed) return null;

  if (
    typeof parsed.ref !== "string" ||
    !parsed.ref.trim() ||
    typeof parsed.guest !== "string" ||
    !parsed.guest.trim() ||
    typeof parsed.tour !== "string" ||
    !parsed.tour.trim() ||
    typeof parsed.date !== "string" ||
    !parsed.date.trim() ||
    typeof parsed.guests !== "number" ||
    !Number.isFinite(parsed.guests) ||
    parsed.guests < 1 ||
    typeof parsed.pay !== "string" ||
    typeof parsed.status !== "string" ||
    !VALID_PASS_STATUSES.has(parsed.status) ||
    typeof parsed.exp !== "number" ||
    typeof parsed.iat !== "number"
  ) {
    return null;
  }

  if (parsed.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    ref: parsed.ref,
    guest: parsed.guest,
    tour: parsed.tour,
    date: parsed.date,
    guests: Math.floor(parsed.guests),
    pay: parsed.pay,
    status: parsed.status as PassTokenStatus,
    iat: parsed.iat,
    exp: parsed.exp,
  };
}
