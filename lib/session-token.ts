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

function getSigningSecret(): string | null {
  const configured = process.env.AUTH_SESSION_SECRET?.trim();
  if (configured) return configured;

  const serverOnlyParts = [
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
    process.env.PAYMONGO_SECRET_KEY?.trim() ?? "",
    process.env.RESEND_API_KEY?.trim() ?? "",
  ].filter(Boolean);

  if (serverOnlyParts.length > 0) {
    return `nl-session-fallback:${serverOnlyParts.join("|")}`;
  }

  // Never trust a hardcoded secret in production; fail closed when unconfigured.
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return "nl-dev-only-session-secret";
}

async function getHmacKey(
  usage: KeyUsage[],
  domain = "session",
): Promise<CryptoKey | null> {
  const secret = getSigningSecret();
  if (!secret) return null;
  const material = domain === "session" ? secret : `${domain}:${secret}`;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(material),
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

/** Sign an arbitrary JSON payload with HMAC-SHA256 using Web Crypto. */
export async function signHmacJson(
  payload: unknown,
  domain = "session",
): Promise<string> {
  const key = await getHmacKey(["sign"], domain);
  if (!key) {
    throw new Error(
      "AUTH_SESSION_SECRET (or a server secret) must be configured in production.",
    );
  }
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedPayload),
  );
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Verify an HMAC-SHA256 signed JSON token; returns null on invalid signature or format. */
export async function verifyHmacJson(
  token: string | undefined | null,
  domain = "session",
): Promise<Record<string, unknown> | null> {
  if (!token || typeof token !== "string") return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const encodedPayload = token.slice(0, dot);
  const encodedSig = token.slice(dot + 1);
  const sigBytes = fromBase64Url(encodedSig);
  const payloadBytes = fromBase64Url(encodedPayload);
  if (!sigBytes || !payloadBytes) return null;

  const key = await getHmacKey(["verify"], domain);
  if (!key) return null;

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
    const parsed: unknown = JSON.parse(decoder.decode(payloadBytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
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
  return signHmacJson(fullPayload, "session");
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionTokenPayload | null> {
  const parsed = (await verifyHmacJson(token, "session")) as Partial<SessionTokenPayload> | null;
  if (!parsed) return null;

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
}
