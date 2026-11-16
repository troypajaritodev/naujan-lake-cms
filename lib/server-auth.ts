import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SEED_USERS,
  type Role,
  type SessionUser,
  type StoredUser,
} from "@/lib/auth-seeds";
import { JsonFileStore } from "@/lib/json-store";
import { cleanEmail, cleanPhone, cleanText } from "@/lib/sanitize";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session-token";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/config";
import type { Database, Tables } from "@/lib/supabase/types";

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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

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

function isVerifiableLocalHash(storedHash: string): boolean {
  return storedHash.startsWith("scrypt$") || SHA256_HEX_PATTERN.test(storedHash);
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

function rowToStoredUser(row: Tables<"users">): StoredUser {
  return {
    id: row.id,
    email: row.email.toLowerCase(),
    fullName: row.full_name,
    phone: row.phone ?? "",
    ...(row.address ? { address: row.address } : {}),
    ...(row.emergency_contact ? { emergencyContact: row.emergency_contact } : {}),
    role: row.role === "admin" ? "admin" : "visitor",
    passwordHash: row.password_hash,
    isActive: row.is_active,
    createdAt: row.created_at,
    ...(row.last_login_at ? { lastLoginAt: row.last_login_at } : {}),
  };
}

const usersStore = new JsonFileStore<StoredUser[]>({
  filename: "users.json",
  fallbackSubdir: "naujan-lake-auth",
  normalize: (raw) =>
    Array.isArray(raw) ? (raw as StoredUser[]) : [...SEED_USERS],
});

async function withUsersLock<T>(
  fn: (users: StoredUser[]) => Promise<{ next?: StoredUser[]; result: T }>,
): Promise<T> {
  return usersStore.withLock(async (current) => {
    const { next, result } = await fn(current);
    return {
      next: next ?? current,
      result,
      skipWrite: !next,
    };
  });
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

async function findSupabaseUser(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  criteria: { id?: string; email?: string },
): Promise<StoredUser | null> {
  if (criteria.id && UUID_PATTERN.test(criteria.id)) {
    const { data, error } = await admin
      .from("users")
      .select("*")
      .eq("id", criteria.id)
      .maybeSingle();
    if (error) {
      throw new ServerAuthError("Authentication storage is temporarily unavailable.", 502);
    }
    if (data) return rowToStoredUser(data);
  }

  const email = criteria.email?.trim().toLowerCase();
  if (email) {
    const { data, error } = await admin
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      throw new ServerAuthError("Authentication storage is temporarily unavailable.", 502);
    }
    if (data) return rowToStoredUser(data);
  }

  return null;
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

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const match = await findSupabaseUser(admin, {
        id: payload.id,
        email: payload.email,
      });
      if (!match || match.isActive === false) return null;
      return toSessionUser(match);
    } catch {
      return null;
    }
  }

  const users = await usersStore.read();
  const match = users.find(
    (entry) => entry.id === payload.id || entry.email === payload.email.toLowerCase(),
  );
  if (!match || match.isActive === false) return null;

  return toSessionUser(match);
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

  const admin = getSupabaseAdminClient();
  if (admin) {
    const existing = await findSupabaseUser(admin, { email });
    if (existing?.isActive === false) {
      throw new ServerAuthError(
        "This account has been suspended. Contact the park office.",
        403,
        "email",
      );
    }

    const sb = createStatelessSupabaseClient();
    const now = new Date().toISOString();

    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        const metaName =
          cleanText(String(data.user.user_metadata?.full_name ?? ""), 120) ||
          email.split("@")[0] ||
          "Park Visitor";
        const metaPhone = cleanPhone(String(data.user.user_metadata?.phone ?? ""));

        if (existing) {
          const { data: updatedRow, error: updateErr } = await admin
            .from("users")
            .update({ last_login_at: now })
            .eq("id", existing.id)
            .select("*")
            .single();
          if (!updateErr && updatedRow) {
            return toSessionUser(rowToStoredUser(updatedRow));
          }
          return toSessionUser({ ...existing, lastLoginAt: now });
        }

        const { data: upserted, error: upsertErr } = await admin
          .from("users")
          .upsert(
            {
              id: data.user.id,
              email,
              full_name: metaName.length >= 2 ? metaName : "Park Visitor",
              phone: metaPhone || null,
              role: "visitor",
              is_active: true,
              password_hash: "supabase-auth-managed",
              last_login_at: now,
            },
            { onConflict: "email" },
          )
          .select("*")
          .single();
        if (upsertErr || !upserted) {
          throw new ServerAuthError("Could not load user profile.", 502);
        }
        return toSessionUser(rowToStoredUser(upserted));
      }

      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          throw new ServerAuthError(
            "Confirm your email address before signing in.",
            403,
            "email",
          );
        }
        const isAuthRejection =
          error.status === 400 ||
          error.status === 401 ||
          /invalid login credentials/i.test(error.message);
        if (isAuthRejection && (!existing || !isVerifiableLocalHash(existing.passwordHash))) {
          if (existing) {
            throw new ServerAuthError("That password is not correct.", 401, "password");
          }
          throw new ServerAuthError(
            "No account matches that email or password.",
            401,
            "email",
          );
        }
      }
    }

    if (existing && isVerifiableLocalHash(existing.passwordHash)) {
      const check = verifyStoredPassword(email, password, existing.passwordHash);
      if (!check.valid) {
        throw new ServerAuthError("That password is not correct.", 401, "password");
      }

      const patch: Database["public"]["Tables"]["users"]["Update"] = {
        last_login_at: now,
        ...(check.needsUpgrade ? { password_hash: hashPasswordScrypt(password) } : {}),
      };
      const { data: updatedRow } = await admin
        .from("users")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single();
      return toSessionUser(
        updatedRow ? rowToStoredUser(updatedRow) : { ...existing, lastLoginAt: now },
      );
    }

    throw new ServerAuthError("No account matches that email.", 401, "email");
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

    const isLocalOnly = existing?.id.startsWith("usr_") ?? false;
    const sb = !isLocalOnly ? createStatelessSupabaseClient() : null;

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
            profileRole = row.role === "admin" ? "admin" : "visitor";
            profileName = row.full_name || profileName;
            profilePhone = row.phone || profilePhone;
            profileActive = row.is_active;
          }
        }

        const synced: StoredUser = {
          ...(existing ?? { createdAt: data.user.created_at ?? new Date().toISOString() }),
          id: existing?.id ?? data.user.id,
          email,
          fullName: profileName,
          phone: profilePhone,
          role: profileRole,
          isActive: profileActive,
          lastLoginAt: new Date().toISOString(),
          passwordHash: hashPasswordScrypt(password),
        };

        const next =
          existingIndex >= 0
            ? users.map((u, idx) => (idx === existingIndex ? synced : u))
            : [...users, synced];
        return { next, result: toSessionUser(synced) };
      }

      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          throw new ServerAuthError(
            "Confirm your email address before signing in.",
            403,
            "email",
          );
        }
        const isAuthRejection =
          error.status === 400 ||
          error.status === 401 ||
          /invalid login credentials/i.test(error.message);
        if (isAuthRejection) {
          if (existing) {
            throw new ServerAuthError("That password is not correct.", 401, "password");
          }
          throw new ServerAuthError(
            "No account matches that email or password.",
            401,
            "email",
          );
        }
      }
    }

    if (existing) {
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
    }

    throw new ServerAuthError("No account matches that email.", 401, "email");
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

  const admin = getSupabaseAdminClient();
  if (admin) {
    const existing = await findSupabaseUser(admin, { email });
    if (existing) {
      throw new ServerAuthError("An account already uses this email.", 409, "email");
    }

    const { data: createdAuth, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });

    if (createError) {
      if (/already been registered|already registered|already exists/i.test(createError.message)) {
        throw new ServerAuthError("An account already uses this email.", 409, "email");
      }
      const status =
        createError.status && createError.status >= 400 && createError.status < 500
          ? createError.status
          : 502;
      throw new ServerAuthError(
        createError.message || "Could not register account right now.",
        status,
        "email",
      );
    }

    const userId = createdAuth.user?.id;
    if (!userId) {
      throw new ServerAuthError("Could not create account right now.", 502, "email");
    }

    const { data: row, error: upsertError } = await admin
      .from("users")
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
          phone: phone || null,
          // Self-registration is always locked to visitor.
          role: "visitor",
          is_active: true,
          password_hash: "supabase-auth-managed",
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (upsertError || !row) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      throw new ServerAuthError("Could not persist user profile.", 502, "email");
    }

    return toSessionUser(rowToStoredUser(row));
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
      if (error) {
        if (/already registered|user already/i.test(error.message)) {
          throw new ServerAuthError("An account already uses this email.", 409, "email");
        }
        const status =
          error.status && error.status >= 400 && error.status < 500 ? error.status : 502;
        throw new ServerAuthError(
          error.message || "Could not register account right now.",
          status,
          "email",
        );
      }
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
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

  const admin = getSupabaseAdminClient();
  if (admin) {
    const existing = await findSupabaseUser(admin, {
      id: session.id,
      email: session.email,
    });
    if (!existing) {
      throw new ServerAuthError("Your session has ended. Sign in again.", 401);
    }

    const { data: updated, error } = await admin
      .from("users")
      .update({
        full_name: fullName,
        phone: phone || null,
        ...(address !== undefined ? { address: address || null } : {}),
        ...(emergencyContact !== undefined
          ? { emergency_contact: emergencyContact || null }
          : {}),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !updated) {
      throw new ServerAuthError("Could not update your profile right now.", 502);
    }

    return toSessionUser(rowToStoredUser(updated));
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

  const admin = getSupabaseAdminClient();
  if (admin) {
    const current = await findSupabaseUser(admin, {
      id: session.id,
      email: session.email,
    });
    if (!current) {
      throw new ServerAuthError("Your session has ended. Sign in again.", 401);
    }
    if (currentPassword === nextPassword) {
      throw new ServerAuthError(
        "Choose a password you have not used before.",
        400,
        "password",
      );
    }

    if (isVerifiableLocalHash(current.passwordHash)) {
      const check = verifyStoredPassword(
        current.email,
        currentPassword,
        current.passwordHash,
      );
      if (!check.valid) {
        throw new ServerAuthError(
          "Your current password is not correct.",
          400,
          "password",
        );
      }

      const { error: updateErr } = await admin
        .from("users")
        .update({ password_hash: hashPasswordScrypt(nextPassword) })
        .eq("id", current.id);
      if (updateErr) {
        throw new ServerAuthError("Could not update your password.", 502, "password");
      }

      // If a matching Supabase Auth record also exists, keep its password in sync.
      const { data: authLookup } = await admin.auth.admin.getUserById(current.id);
      if (authLookup.user) {
        await admin.auth.admin.updateUserById(current.id, {
          password: nextPassword,
        });
      }
      return;
    }

    const sb = createStatelessSupabaseClient();
    if (!sb) {
      throw new ServerAuthError(
        "Could not reach authentication service to verify password.",
        502,
        "password",
      );
    }

    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: current.email,
      password: currentPassword,
    });
    if (signInErr) {
      if (/email not confirmed/i.test(signInErr.message)) {
        throw new ServerAuthError(
          "Confirm your email address before changing your password.",
          403,
          "password",
        );
      }
      const isWrongPassword =
        signInErr.status === 400 ||
        signInErr.status === 401 ||
        /invalid login credentials/i.test(signInErr.message);
      if (isWrongPassword) {
        throw new ServerAuthError(
          "Your current password is not correct.",
          400,
          "password",
        );
      }
      throw new ServerAuthError(
        "Could not reach authentication service to verify password.",
        502,
        "password",
      );
    }

    const { error: adminUpdateErr } = await admin.auth.admin.updateUserById(
      current.id,
      { password: nextPassword },
    );
    if (adminUpdateErr) {
      throw new ServerAuthError(
        adminUpdateErr.message || "Could not update your password.",
        400,
        "password",
      );
    }
    return;
  }

  await withUsersLock(async (users) => {
    const index = users.findIndex(
      (entry) => entry.id === session.id || entry.email === session.email.toLowerCase(),
    );
    if (index === -1) {
      throw new ServerAuthError("Your session has ended. Sign in again.", 401);
    }

    const current = users[index];
    if (currentPassword === nextPassword) {
      throw new ServerAuthError(
        "Choose a password you have not used before.",
        400,
        "password",
      );
    }

    const isLocalOnly = current.id.startsWith("usr_");
    const sb = !isLocalOnly ? createStatelessSupabaseClient() : null;

    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({
        email: current.email,
        password: currentPassword,
      });
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          throw new ServerAuthError(
            "Confirm your email address before changing your password.",
            403,
            "password",
          );
        }
        const isWrongPassword =
          error.status === 400 ||
          error.status === 401 ||
          /invalid login credentials/i.test(error.message);
        if (isWrongPassword) {
          throw new ServerAuthError(
            "Your current password is not correct.",
            400,
            "password",
          );
        }
        throw new ServerAuthError(
          "Could not reach authentication service to verify password.",
          502,
          "password",
        );
      }

      if (data.session?.access_token) {
        const authed = createStatelessSupabaseClient(data.session.access_token);
        if (authed) {
          const { error: updateError } = await authed.auth.updateUser({
            password: nextPassword,
          });
          if (updateError) {
            throw new ServerAuthError(
              updateError.message || "Could not update your password.",
              400,
              "password",
            );
          }
        }
      }
    } else {
      const check = verifyStoredPassword(
        current.email,
        currentPassword,
        current.passwordHash,
      );
      if (!check.valid) {
        throw new ServerAuthError(
          "Your current password is not correct.",
          400,
          "password",
        );
      }
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
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) {
      throw new ServerAuthError("Could not load user directory.", 502);
    }
    return data.map((row) => toSessionUser(rowToStoredUser(row)));
  }

  const users = await usersStore.read();
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

  const admin = getSupabaseAdminClient();
  if (admin) {
    const target = await findSupabaseUser(admin, { id: userId });
    if (!target) {
      throw new ServerAuthError("That account no longer exists.", 404);
    }
    if (target.role === role) {
      return toSessionUser(target);
    }
    if (role === "visitor" && target.role === "admin") {
      const { count, error: countErr } = await admin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (countErr) {
        throw new ServerAuthError("Could not verify remaining staff accounts.", 502);
      }
      if ((count ?? 0) <= 1) {
        throw new ServerAuthError(
          "This is the last staff account. Promote someone else first.",
          400,
        );
      }
    }

    const { data: updated, error } = await admin
      .from("users")
      .update({ role })
      .eq("id", target.id)
      .select("*")
      .single();
    if (error || !updated) {
      throw new ServerAuthError("Could not update role right now.", 502);
    }
    return toSessionUser(rowToStoredUser(updated));
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

  const admin = getSupabaseAdminClient();
  if (admin) {
    const target = await findSupabaseUser(admin, { id: userId });
    if (!target) {
      throw new ServerAuthError("That account no longer exists.", 404);
    }
    if (!isActive && target.role === "admin") {
      const { count, error: countErr } = await admin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);
      if (countErr) {
        throw new ServerAuthError("Could not verify active staff accounts.", 502);
      }
      if ((count ?? 0) <= 1) {
        throw new ServerAuthError("This is the last active staff account.", 400);
      }
    }

    const { data: updated, error } = await admin
      .from("users")
      .update({ is_active: isActive })
      .eq("id", target.id)
      .select("*")
      .single();
    if (error || !updated) {
      throw new ServerAuthError("Could not update account status right now.", 502);
    }
    return toSessionUser(rowToStoredUser(updated));
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
