import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSupabaseAdminClient, getSupabaseAdminSigningKey } from "@/lib/supabase/admin";

const COOKIE_NAME = "nl.admin.session";
const SESSION_SECONDS = 8 * 60 * 60;

type AdminSession = {
  id: string;
  expiresAt: number;
};

function signature(payload: string): Buffer {
  return createHmac("sha256", getSupabaseAdminSigningKey())
    .update(payload)
    .digest();
}

function encodeSession(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export async function createAdminSession(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error("Enter the administrator email and password.");
  }

  const client = getSupabaseAdminClient();
  const { data: user, error } = await client
    .from("users")
    .select("id, email, role, is_active, password_hash")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) throw new Error(`Could not verify administrator: ${error.message}`);

  const passwordHash = createHash("sha256")
    .update(`${normalizedEmail}:${password}`)
    .digest();
  const storedHash = user?.password_hash
    ? Buffer.from(user.password_hash, "hex")
    : Buffer.alloc(0);
  const passwordMatches =
    storedHash.length === passwordHash.length &&
    timingSafeEqual(storedHash, passwordHash);

  if (!user || user.role !== "admin" || !user.is_active || !passwordMatches) {
    throw new Error("Administrator credentials could not be verified.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encodeSession({ id: user.id, expiresAt }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireAdminClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) throw new Error("Your administrator session has expired. Sign in again.");

  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) {
    throw new Error("Your administrator session is invalid. Sign in again.");
  }

  const suppliedSignature = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = signature(payload);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new Error("Your administrator session is invalid. Sign in again.");
  }

  let session: AdminSession;
  try {
    session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AdminSession;
  } catch {
    throw new Error("Your administrator session is invalid. Sign in again.");
  }

  if (
    typeof session.id !== "string" ||
    !Number.isInteger(session.expiresAt) ||
    session.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("Your administrator session has expired. Sign in again.");
  }

  const client = getSupabaseAdminClient();
  const { data: user, error } = await client
    .from("users")
    .select("id")
    .eq("id", session.id)
    .eq("role", "admin")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Could not verify administrator: ${error.message}`);
  if (!user) throw new Error("Administrator access has been revoked.");

  return client;
}
