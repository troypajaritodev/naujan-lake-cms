/**
 * Visitor accounts and session handling (Requirement B + G).
 *
 * This build has no server, so accounts live in `localStorage` and the
 * password is stored as a salted SHA-256 digest — never in clear text.
 * Swapping this module for Supabase auth later keeps the same public API.
 */

import { useSyncExternalStore } from "react";

export type Role = "admin" | "visitor";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  createdAt: string;
  isActive?: boolean;
  lastLoginAt?: string;
  address?: string;
  emergencyContact?: string;
};

type StoredUser = SessionUser & { passwordHash: string };

export const USERS_KEY = "nl.users.v1";
export const SESSION_KEY = "nl.session.v1";

/**
 * Seeded accounts so the portal can be demonstrated without a database.
 * Hashes are `sha256(email + ":" + password)`.
 */
const SEED_USERS: StoredUser[] = [
  {
    id: "usr_admin_seed",
    email: "admin@naujanlake.gov.ph",
    fullName: "Park Administrator",
    phone: "+63 917 000 0001",
    role: "admin",
    createdAt: "2026-01-05T08:00:00.000Z",
    passwordHash:
      "fc21fbec03dcacbf407b188a496f7a83e57acdac7eb7ebc387dcaaa046cbe66d",
  },
  {
    id: "usr_visitor_seed",
    email: "visitor@example.com",
    fullName: "Demo Visitor",
    phone: "+63 917 000 0002",
    role: "visitor",
    createdAt: "2026-02-11T08:00:00.000Z",
    passwordHash:
      "3f0dd34782ec47768171b8e1a8b1980df0cadc01c78e0ac12f510e48d1dd7400",
  },
  {
    id: "usr_ana_seed",
    email: "ana.reyes@example.com",
    fullName: "Ana Reyes",
    phone: "+63 918 442 1180",
    role: "visitor",
    createdAt: "2026-09-14T08:00:00.000Z",
    passwordHash:
      "d949210e0d28020725aef6f4c3bbe6e8e38d46881e527487e53d32a0bfca6acc",
  },
  {
    id: "usr_carlo_seed",
    email: "carlo.mendoza@example.com",
    fullName: "Carlo Mendoza",
    phone: "+63 920 118 7743",
    role: "visitor",
    createdAt: "2026-10-02T08:00:00.000Z",
    passwordHash:
      "37f186a01fa29f05c7684684dbb224ce28367b2f30b339b3fd24180666ba2d4f",
  },
];

export class AuthError extends Error {
  field?: "fullName" | "email" | "phone" | "password" | "confirmPassword";

  constructor(
    message: string,
    field?: "fullName" | "email" | "phone" | "password" | "confirmPassword",
  ) {
    super(message);
    this.name = "AuthError";
    this.field = field;
  }
}

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Subscribe to account/session changes. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readUsers(): StoredUser[] {
  if (!canUseStorage()) return [...SEED_USERS];

  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) {
      window.localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
      return [...SEED_USERS];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [...SEED_USERS];
  } catch {
    return [...SEED_USERS];
  }
}

function writeUsers(users: StoredUser[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toSessionUser(user: StoredUser): SessionUser {
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

export function getSession(): SessionUser | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { id?: string };
    if (!parsed?.id) return null;

    // Re-read the record so a renamed profile, role change, or suspension is reflected.
    const stored = readUsers().find((user) => user.id === parsed.id);
    if (!stored || stored.isActive === false) return null;
    return toSessionUser(stored);
  } catch {
    return null;
  }
}

function setSession(user: StoredUser | null) {
  if (!canUseStorage()) return;

  if (user) {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: user.id, at: new Date().toISOString() }),
    );
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
  emit();
}

/**
 * Cached snapshot for `useSyncExternalStore` — the same reference is returned
 * until the stored session or user table actually changes.
 */
let snapshotKey: string | null = null;
let snapshotValue: SessionUser | null = null;

export function getSessionSnapshot(): SessionUser | null {
  if (!canUseStorage()) return null;

  const key = `${window.localStorage.getItem(SESSION_KEY) ?? ""}|${window.localStorage.getItem(USERS_KEY) ?? ""}`;
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshotValue = getSession();
  }
  return snapshotValue;
}

export function getServerSessionSnapshot(): SessionUser | null {
  return null;
}

/** Salted digest — the email is the salt, so identical passwords differ per account. */
export async function hashPassword(email: string, password: string) {
  const data = new TextEncoder().encode(`${email.trim().toLowerCase()}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

/** At least 8 characters, with a letter and a number. */
export function passwordIssue(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password)) return "Add at least one letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  return null;
}

export type RegisterInput = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
};

export async function register(input: RegisterInput): Promise<SessionUser> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = (input.phone ?? "").trim();

  if (fullName.length < 2) {
    throw new AuthError("Enter your full name.", "fullName");
  }
  if (!validateEmail(email)) {
    throw new AuthError("Enter a valid email address.", "email");
  }

  const issue = passwordIssue(input.password);
  if (issue) throw new AuthError(issue, "password");
  if (input.password !== input.confirmPassword) {
    throw new AuthError("Passwords do not match.", "confirmPassword");
  }

  const users = readUsers();
  if (users.some((user) => user.email === email)) {
    throw new AuthError("An account already uses this email.", "email");
  }

  const user: StoredUser = {
    id: `usr_${crypto.randomUUID().slice(0, 8)}`,
    email,
    fullName,
    phone,
    // Self-registration can never create an administrator.
    role: "visitor",
    createdAt: new Date().toISOString(),
    passwordHash: await hashPassword(email, input.password),
  };

  writeUsers([...users, user]);
  setSession(user);
  return toSessionUser(user);
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    throw new AuthError("Enter your email and password.", "email");
  }

  const users = readUsers();
  const index = users.findIndex((entry) => entry.email === normalized);
  const user = index >= 0 ? users[index] : undefined;
  if (!user) {
    throw new AuthError("No account matches that email.", "email");
  }
  if (user.isActive === false) {
    throw new AuthError(
      "This account has been suspended. Contact the park office.",
      "email",
    );
  }

  const digest = await hashPassword(normalized, password);
  if (digest !== user.passwordHash) {
    throw new AuthError("That password is not correct.", "password");
  }

  const signedInUser: StoredUser = {
    ...user,
    lastLoginAt: new Date().toISOString(),
  };
  users[index] = signedInUser;
  writeUsers(users);
  setSession(signedInUser);
  return toSessionUser(signedInUser);
}

export function signOut() {
  setSession(null);
}

export type ProfileInput = {
  fullName: string;
  phone: string;
  address?: string;
  emergencyContact?: string;
};

export function updateProfile({
  fullName,
  phone,
  address,
  emergencyContact,
}: ProfileInput): SessionUser {
  const session = getSession();
  if (!session) throw new AuthError("Your session has ended. Sign in again.");

  const name = fullName.trim();
  if (name.length < 2) throw new AuthError("Enter your full name.", "fullName");

  const nextAddress = address !== undefined ? address.trim().slice(0, 160) : undefined;
  const nextEmergency =
    emergencyContact !== undefined ? emergencyContact.trim().slice(0, 120) : undefined;

  const users = readUsers().map((user) =>
    user.id === session.id
      ? {
          ...user,
          fullName: name,
          phone: phone.trim(),
          ...(nextAddress !== undefined ? { address: nextAddress } : {}),
          ...(nextEmergency !== undefined ? { emergencyContact: nextEmergency } : {}),
        }
      : user,
  );
  writeUsers(users);
  emit();

  const updated = users.find((user) => user.id === session.id);
  if (!updated) throw new AuthError("Your session has ended. Sign in again.");
  return toSessionUser(updated);
}

export async function changePassword(
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const session = getSession();
  if (!session) throw new AuthError("Your session has ended. Sign in again.");

  const issue = passwordIssue(nextPassword);
  if (issue) throw new AuthError(issue, "password");

  const users = readUsers();
  const index = users.findIndex((user) => user.id === session.id);
  if (index === -1) throw new AuthError("Your session has ended. Sign in again.");

  const currentDigest = await hashPassword(session.email, currentPassword);
  if (currentDigest !== users[index].passwordHash) {
    throw new AuthError("Your current password is not correct.", "password");
  }
  if (currentPassword === nextPassword) {
    throw new AuthError("Choose a password you have not used before.", "password");
  }

  users[index] = {
    ...users[index],
    passwordHash: await hashPassword(session.email, nextPassword),
  };
  writeUsers(users);
  emit();
}

/**
 * Promote a customer to staff, or demote staff back to customer.
 *
 * Only staff can call this, and only on someone else: changing your own role
 * would either hand out access you should not grant yourself or lock you out
 * of the panel on your next render. The last remaining staff account is also
 * protected, so the panel can never end up with nobody who can open it.
 *
 * When the account store moves to Supabase this becomes
 * `update public.users set role = $1 where id = $2` behind the admin policy in
 * `supabase/schema.sql`; the guards below stay as the client-side half.
 */
export function updateUserRole(userId: string, role: Role): SessionUser {
  const session = getSession();
  if (!session) throw new AuthError("Your session has ended. Sign in again.");
  if (session.role !== "admin") {
    throw new AuthError("Only park staff can change an account's role.");
  }
  if (session.id === userId) {
    throw new AuthError("You cannot change your own role. Ask another staff member.");
  }

  const users = readUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) throw new AuthError("That account no longer exists.");

  const target = users[index];
  if (target.role === role) return toSessionUser(target);

  if (role === "visitor" && target.role === "admin") {
    const staff = users.filter((user) => user.role === "admin").length;
    if (staff <= 1) {
      throw new AuthError("This is the last staff account. Promote someone else first.");
    }
  }

  users[index] = { ...target, role };
  writeUsers(users);
  // The session snapshot re-reads the account table, so a role change is
  // visible to the guard and the header without a reload.
  emit();
  return toSessionUser(users[index]);
}

export function setUserActive(userId: string, isActive: boolean): SessionUser {
  const session = getSession();
  if (!session) throw new AuthError("Your session has ended. Sign in again.");
  if (session.role !== "admin") {
    throw new AuthError("Only park staff can change account status.");
  }
  if (session.id === userId && !isActive) {
    throw new AuthError("You cannot suspend your own account.");
  }

  const users = readUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) throw new AuthError("That account no longer exists.");

  const target = users[index];
  if (!isActive && target.role === "admin") {
    const activeAdmins = users.filter(
      (user) => user.role === "admin" && user.isActive !== false,
    ).length;
    if (activeAdmins <= 1) {
      throw new AuthError("This is the last active staff account.");
    }
  }

  users[index] = { ...target, isActive };
  writeUsers(users);
  emit();
  return toSessionUser(users[index]);
}

export type UserSummary = {
  total: number;
  staff: number;
  customers: number;
  active: number;
  suspended: number;
};

/** Every account, newest first — password digests are stripped. */
export function listUsers(): SessionUser[] {
  return readUsers()
    .map(toSessionUser)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const EMPTY_USERS: SessionUser[] = [];

let seedSnapshot: SessionUser[] | null = null;

function seedSummaries(): SessionUser[] {
  seedSnapshot ??= SEED_USERS.map(toSessionUser).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return seedSnapshot;
}

let usersSnapshotRaw: string | null = null;
let usersSnapshotValue: SessionUser[] = EMPTY_USERS;

/**
 * Cached snapshot for `useSyncExternalStore`. Unlike `listUsers`, this never
 * writes to storage — the account tables can therefore render on the server
 * and hydrate without a "seed count vs stored count" mismatch.
 */
export function getUsersSnapshot(): SessionUser[] {
  if (!canUseStorage()) return EMPTY_USERS;

  const raw = window.localStorage.getItem(USERS_KEY);
  if (raw !== usersSnapshotRaw) {
    usersSnapshotRaw = raw;
    usersSnapshotValue = raw ? listUsers() : seedSummaries();
  }
  return usersSnapshotValue;
}

export function getServerUsersSnapshot(): SessionUser[] {
  return EMPTY_USERS;
}

/** Live account list for the admin tables. */
export function useUsers(): SessionUser[] {
  return useSyncExternalStore(
    subscribe,
    getUsersSnapshot,
    getServerUsersSnapshot,
  );
}

export function summariseUsers(users: SessionUser[]): UserSummary {
  const staff = users.filter((user) => user.role === "admin").length;
  const suspended = users.filter((user) => user.isActive === false).length;
  return {
    total: users.length,
    staff,
    customers: users.length - staff,
    active: users.length - suspended,
    suspended,
  };
}
