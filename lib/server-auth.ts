import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SEED_USERS,
  type Role,
  type SessionUser,
  type StoredUser,
} from "@/lib/auth-seeds";
import { cleanEmail, cleanPhone, cleanText } from "@/lib/sanitize";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session-token";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export class ServerAuthError extends Error {
  status: number;
  field?: "fullName" | "email" | "phone" | "password" | "confirmPassword";

  constructor(
    message: string,
    status = 400,
    field?: "fullName" | "email" | "phone" | "password" | "confirmPassword",
  ) {
    super(message);
    this.name = "ServerAuthError";
    this.status = status;
    this.field = field;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmailAddress(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function checkPasswordPolicy(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password)) return "Add at least one letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  return null;
}

/** Per-user salted `scrypt` password hash (`scrypt$<saltHex>$<keyHex>`). */
export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function constantTimeHexEqual(leftHex: string, rightHex: string): boolean {
  if (leftHex.length !== rightHex.length) return false;
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyStoredPassword(
  email: string,
  password: string,
  storedHash: string,
): { valid: boolean; needsUpgrade: boolean } {
  if (storedHash.startsWith("scrypt$")) {
    const [, salt, expectedHex] = storedHash.split("$");
    if (!salt || !expectedHex) return { valid: false, needsUpgrade: false };
    const derivedHex = crypto.scryptSync(password, salt, 64).toString("hex");
    return {
      valid: constantTimeHexEqual(derivedHex, expectedHex),
      needsUpgrade: false,
    };
  }

  const legacyDigest = crypto
    .createHash("sha256")
    .update(`${email.trim().toLowerCase()}:${password}`)
    .digest("hex");

  return {
    valid: constantTimeHexEqual(legacyDigest, storedHash),
    needsUpgrade: true,
  };
}

export function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    isActive: user.isActive ?? true,
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt } : {}),
    ...(user.address ? { address: user.address } : {}),
    ...(user.emergencyContact ? { emergencyContact: user.emergencyContact } : {}),
  };
}

const DATA_FILE = path.join(process.cwd(), ".data", "users.json");
const FALLBACK_DATA_FILE = path.join(os.tmpdir(), "naujan-lake-users.json");

let writeQueue: Promise<void> = Promise.resolve();

async function readUsersFromDisk(): Promise<StoredUser[]> {
  for (const candidate of [DATA_FILE, FALLBACK_DATA_FILE]) {
    try {
      const raw = await fs.readFile(candidate, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as StoredUser[];
    } catch {
      // Try next storage location or seed defaults.
    }
  }
  const seeded = [...SEED_USERS];
  await writeUsersToDisk(seeded);
  return seeded;
}

async function writeUsersToDisk(users: StoredUser[]): Promise<void> {
  const payload = JSON.stringify(users, null, 2);
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, payload, "utf8");
  } catch {
    try {
      await fs.writeFile(FALLBACK_DATA_FILE, payload, "utf8");
    } catch {
      // Non-fatal in read-only runtimes; session cookie still preserves state.
    }
  }
}

async function withUsersLock<T>(fn: (users: StoredUser[]) => Promise<{ next?: StoredUser[]; result: T }>): Promise<T> {
  const run = async () => {
    const current = await readUsersFromDisk();
    const { next, result } = await fn(current);
    if (next) {
      await writeUsersToDisk(next);
    }
    return result;
  };
  const pending = writeQueue.then(run, run);
  writeQueue = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

function createStatelessSupabaseClient(accessToken?: string) {
  if (!isSupabaseConfigured() || !supabaseUrl || !supabaseKey) return null;
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : {}),
  });
}

export async function attachSessionCookie(
  response: NextResponse,
  user: SessionUser,
): Promise<NextResponse> {
  const token = await signSessionToken({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function getServerSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const users = await readUsersFromDisk();
  const match = users.find(
    (entry) => entry.id === payload.id || entry.email === payload.email.toLowerCase(),
  );
  if (match) {
    if (match.isActive === false) return null;
    return toSessionUser(match);
  }

  return {
    id: payload.id,
    email: payload.email,
    fullName: payload.fullName,
    phone: "",
    role: payload.role,
    createdAt: new Date().toISOString(),
    isActive: true,
  };
}

export async function requireSession(): Promise<SessionUser | null> {
  return getServerSession();
}

export async function requireAdminSession(): Promise<SessionUser | null> {
  const session = await getServerSession();
  if (!session || session.role !== "admin" || session.isActive === false) {
    return null;
  }
  return session;
}

export async function authenticateUser(
  rawEmail: string,
  password: string,
): Promise<SessionUser> {
  const email = cleanEmail(rawEmail);
  if (!email || !password) {
    throw new ServerAuthError("Enter your email and password.", 400, "email");
  }

  return withUsersLock(async (users) => {
    const existingIndex = users.findIndex((entry) => entry.email === email);
    const existing = existingIndex >= 0 ? users[existingIndex] : undefined;

    if (existing?.isActive === false) {
      throw new ServerAuthError(
        "This account has been suspended. Contact the park office.",
        403,
        "email",
      );
    }

    // Prefer live Supabase Auth verification when configured.
    const sb = createStatelessSupabaseClient();
    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        let profileRole: Role = existing?.role ?? "visitor";
        let profileName =
          existing?.fullName ||
          cleanText(String(data.user.user_metadata?.full_name ?? ""), 120) ||
          email.split("@")[0];
        let profilePhone =
          existing?.phone ||
          cleanPhone(String(data.user.user_metadata?.phone ?? ""));
        let profileActive = existing?.isActive ?? true;

        if (data.session?.access_token) {
          const authed = createStatelessSupabaseClient(data.session.access_token);
          const { data: row } = authed
            ? await authed
                .from("users")
                .select("full_name, phone, role, is_active")
                .eq("id", data.user.id)
                .maybeSingle()
            : { data: null };

          if (row) {
            if (row.is_active === false) {
              throw new ServerAuthError(
                "This account has been suspended. Contact the park office.",
                403,
                "email",
              );
            }
            profileRole = existing?.role ?? (row.role === "admin" ? "admin" : "visitor");
            profileName = existing?.fullName || row.full_name || profileName;
            profilePhone = existing?.phone || row.phone || profilePhone;
            profileActive = existing?.isActive ?? row.is_active;
          }
        }

        const synced: StoredUser = {
          ...(existing ?? {
            createdAt: data.user.created_at ?? new Date().toISOString(),
          }),
          id: existing?.id ?? data.user.id,
          email,
          fullName: profileName,
          phone: profilePhone,
          role: profileRole,
          isActive: profileActive,
          lastLoginAt: new Date().toISOString(),
          passwordHash: hashPasswordScrypt(password),
        };

        const next = [...users];
        if (existingIndex >= 0) {
          next[existingIndex] = synced;
        } else {
          next.push(synced);
        }
        return { next, result: toSessionUser(synced) };
      }
    }

    if (!existing) {
      throw new ServerAuthError("No account matches that email.", 401, "email");
    }

    const check = verifyStoredPassword(email, password, existing.passwordHash);
    if (!check.valid) {
      throw new ServerAuthError("That password is not correct.", 401, "password");
    }

    const signedIn: StoredUser = {
      ...existing,
      lastLoginAt: new Date().toISOString(),
      passwordHash: check.needsUpgrade
        ? hashPasswordScrypt(password)
        : existing.passwordHash,
    };

    const next = [...users];
    next[existingIndex] = signedIn;
    return { next, result: toSessionUser(signedIn) };
  });
}

export async function registerVisitorAccount(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}): Promise<SessionUser> {
  const fullName = cleanText(input.fullName ?? "", 120);
  const email = cleanEmail(input.email ?? "");
  const phone = cleanPhone(input.phone ?? "");
  const password = String(input.password ?? "");
  const confirmPassword = String(input.confirmPassword ?? "");

  if (fullName.length < 2) {
    throw new ServerAuthError("Enter your full name.", 400, "fullName");
  }
  if (!validateEmailAddress(email)) {
    throw new ServerAuthError("Enter a valid email address.", 400, "email");
  }
  const issue = checkPasswordPolicy(password);
  if (issue) {
    throw new ServerAuthError(issue, 400, "password");
  }
  if (password !== confirmPassword) {
    throw new ServerAuthError("Passwords do not match.", 400, "confirmPassword");
  }

  return withUsersLock(async (users) => {
    if (users.some((entry) => entry.email === email)) {
      throw new ServerAuthError("An account already uses this email.", 409, "email");
    }

    let userId = `usr_${crypto.randomUUID().slice(0, 8)}`;

    const sb = createStatelessSupabaseClient();
    if (sb) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone } },
      });
      if (error && /already registered/i.test(error.message)) {
        throw new ServerAuthError("An account already uses this email.", 409, "email");
      }
      if (data.user?.id) {
        userId = data.user.id;
      }
    }

    const created: StoredUser = {
      id: userId,
      email,
      fullName,
      phone,
      // Self-registration is always locked to visitor.
      role: "visitor",
      isActive: true,
      createdAt: new Date().toISOString(),
      passwordHash: hashPasswordScrypt(password),
    };

    return {
      next: [...users, created],
      result: toSessionUser(created),
    };
  });
}

export async function updateCurrentUserProfile(
  session: SessionUser,
  input: {
    fullName: string;
    phone: string;
    address?: string;
    emergencyContact?: string;
  },
): Promise<SessionUser> {
  const fullName = cleanText(input.fullName ?? "", 120);
  const phone = cleanPhone(input.phone ?? "");
  const address =
    input.address !== undefined ? cleanText(input.address, 160) : undefined;
  const emergencyContact =
    input.emergencyContact !== undefined
      ? cleanText(input.emergencyContact, 120)
      : undefined;

  if (fullName.length < 2) {
    throw new ServerAuthError("Enter your full name.", 400, "fullName");
  }

  return withUsersLock(async (users) => {
    const index = users.findIndex(
      (entry) => entry.id === session.id || entry.email === session.email.toLowerCase(),
    );
    if (index === -1) {
      throw new ServerAuthError("Your session has ended. Sign in again.", 401);
    }

    const updated: StoredUser = {
      ...users[index],
      fullName,
      phone,
      ...(address !== undefined ? { address } : {}),
      ...(emergencyContact !== undefined ? { emergencyContact } : {}),
    };

    const next = [...users];
    next[index] = updated;
    return { next, result: toSessionUser(updated) };
  });
}

export async function changeCurrentUserPassword(
  session: SessionUser,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const issue = checkPasswordPolicy(nextPassword);
  if (issue) {
    throw new ServerAuthError(issue, 400, "password");
  }

  await withUsersLock(async (users) => {
    const index = users.findIndex(
      (entry) => entry.id === session.id || entry.email === session.email.toLowerCase(),
    );
    if (index === -1) {
      throw new ServerAuthError("Your session has ended. Sign in again.", 401);
    }

    const current = users[index];
    const check = verifyStoredPassword(current.email, currentPassword, current.passwordHash);
    if (!check.valid) {
      throw new ServerAuthError(
        "Your current password is not correct.",
        400,
        "password",
      );
    }
    if (currentPassword === nextPassword) {
      throw new ServerAuthError(
        "Choose a password you have not used before.",
        400,
        "password",
      );
    }

    const next = [...users];
    next[index] = {
      ...current,
      passwordHash: hashPasswordScrypt(nextPassword),
    };
    return { next, result: undefined };
  });
}

export async function listServerUsers(): Promise<SessionUser[]> {
  const users = await readUsersFromDisk();
  return users
    .map(toSessionUser)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateServerUserRole(
  actor: SessionUser,
  userId: string,
  role: Role,
): Promise<SessionUser> {
  if (actor.role !== "admin") {
    throw new ServerAuthError("Only park staff can change an account's role.", 403);
  }
  if (actor.id === userId) {
    throw new ServerAuthError(
      "You cannot change your own role. Ask another staff member.",
      400,
    );
  }

  return withUsersLock(async (users) => {
    const index = users.findIndex((entry) => entry.id === userId);
    if (index === -1) {
      throw new ServerAuthError("That account no longer exists.", 404);
    }

    const target = users[index];
    if (target.role === role) {
      return { result: toSessionUser(target) };
    }

    if (role === "visitor" && target.role === "admin") {
      const staff = users.filter((entry) => entry.role === "admin").length;
      if (staff <= 1) {
        throw new ServerAuthError(
          "This is the last staff account. Promote someone else first.",
          400,
        );
      }
    }

    const updated: StoredUser = { ...target, role };
    const next = [...users];
    next[index] = updated;
    return { next, result: toSessionUser(updated) };
  });
}

export async function setServerUserActive(
  actor: SessionUser,
  userId: string,
  isActive: boolean,
): Promise<SessionUser> {
  if (actor.role !== "admin") {
    throw new ServerAuthError("Only park staff can change account status.", 403);
  }
  if (actor.id === userId && !isActive) {
    throw new ServerAuthError("You cannot suspend your own account.", 400);
  }

  return withUsersLock(async (users) => {
    const index = users.findIndex((entry) => entry.id === userId);
    if (index === -1) {
      throw new ServerAuthError("That account no longer exists.", 404);
    }

    const target = users[index];
    if (!isActive && target.role === "admin") {
      const activeAdmins = users.filter(
        (entry) => entry.role === "admin" && entry.isActive !== false,
      ).length;
      if (activeAdmins <= 1) {
        throw new ServerAuthError("This is the last active staff account.", 400);
      }
    }

    const updated: StoredUser = { ...target, isActive };
    const next = [...users];
    next[index] = updated;
    return { next, result: toSessionUser(updated) };
  });
}

export function authErrorResponse(error: unknown, fallback = "Authentication failed.") {
  if (error instanceof ServerAuthError) {
    return NextResponse.json(
      { error: error.message, ...(error.field ? { field: error.field } : {}) },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
