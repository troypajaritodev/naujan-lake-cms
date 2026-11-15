import type { Role } from "@/lib/auth-seeds";

export const SESSION_COOKIE_NAME = "nl_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionTokenPayload = {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSigningSecret(): string {
  const configured = process.env.AUTH_SESSION_SECRET?.trim();
  if (configured) return configured;

  const fallbackParts = [
    process.env.RESEND_API_KEY?.trim() ?? "",
    process.env.PAYMONGO_SECRET_KEY?.trim() ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "naujan-lake-local",
  ].join("|");
  return `nl-session-fallback:${fallbackParts}`;
}

async function getHmacKey(usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array | null {
  try {
    const padded = input
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(input.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function signSessionToken(
  payload: Omit<SessionTokenPayload, "exp">,
): Promise<string> {
  const fullPayload: SessionTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(fullPayload)));
  const key = await getHmacKey(["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedPayload),
  );
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionTokenPayload | null> {
  if (!token || typeof token !== "string") return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const encodedPayload = token.slice(0, dot);
  const encodedSig = token.slice(dot + 1);
  const sigBytes = fromBase64Url(encodedSig);
  const payloadBytes = fromBase64Url(encodedPayload);
  if (!sigBytes || !payloadBytes) return null;

  const key = await getHmacKey(["verify"]);
  const sigCopy = new Uint8Array(sigBytes.length);
  sigCopy.set(sigBytes);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigCopy.buffer,
    encoder.encode(encodedPayload),
  );
  if (!valid) return null;

  try {
    const parsed = JSON.parse(decoder.decode(payloadBytes)) as Partial<SessionTokenPayload>;
    if (
      !parsed.id ||
      !parsed.email ||
      (parsed.role !== "admin" && parsed.role !== "visitor") ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      id: parsed.id,
      email: parsed.email,
      role: parsed.role,
      fullName: parsed.fullName ?? parsed.email,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
