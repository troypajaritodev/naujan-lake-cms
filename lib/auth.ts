/**
 * Visitor accounts and session handling (Requirement B + G).
 *
 * Authentication, password hashing (`scrypt` on the server / Supabase Auth),
 * and `HttpOnly` session cookies (`nl_session`) live on the server via
 * `/api/auth/*` and `/api/admin/users`. Client storage only caches sanitized
 * session/profile metadata for instant cross-tab UI reactivity — password
 * digests are never stored in or returned to the browser.
 */

import { useSyncExternalStore } from "react";
import { SEED_USERS, type Role, type SessionUser } from "@/lib/auth-seeds";

export type { Role, SessionUser };

export const USERS_KEY = "nl.users.v1";
export const SESSION_KEY = "nl.session.v1";

type AuthField = "fullName" | "email" | "phone" | "password" | "confirmPassword";

export class AuthError extends Error {
  field?: AuthField;

  constructor(message: string, field?: AuthField) {
    super(message);
    this.name = "AuthError";
    this.field = field;
  }
}

const listeners = new Set<() => void>();
let storageBound = false;

function emit() {
  for (const listener of listeners) listener();
}

function bindStorage() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_KEY || event.key === USERS_KEY) emit();
  });
}

/** Subscribe to account/session changes. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  bindStorage();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function stripPasswordHash(user: SessionUser & { passwordHash?: string }): SessionUser {
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

function seedSummaries(): SessionUser[] {
  return SEED_USERS.map(stripPasswordHash).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

function readCachedUsers(): SessionUser[] {
  if (!canUseStorage()) return seedSummaries();

  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return seedSummaries();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as (SessionUser & { passwordHash?: string })[]).map(stripPasswordHash)
      : seedSummaries();
  } catch {
    return seedSummaries();
  }
}

function writeCachedUsers(users: SessionUser[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    USERS_KEY,
    JSON.stringify(users.map(stripPasswordHash)),
  );
  emit();
}

function upsertCachedUser(user: SessionUser) {
  if (!canUseStorage()) return;
  const clean = stripPasswordHash(user);
  const current = readCachedUsers();
  const index = current.findIndex(
    (entry) => entry.id === clean.id || entry.email === clean.email,
  );
  const next = [...current];
  if (index >= 0) {
    next[index] = clean;
  } else {
    next.unshift(clean);
  }
  writeCachedUsers(next);
}

function setCachedSession(user: SessionUser | null) {
  if (!canUseStorage()) return;

  if (user) {
    const clean = stripPasswordHash(user);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(clean));
    upsertCachedUser(clean);
  } else if (window.localStorage.getItem(SESSION_KEY) !== null) {
    window.localStorage.removeItem(SESSION_KEY);
    emit();
  }
}

export function getSession(): SessionUser | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser | null;
    if (!parsed?.id || !parsed?.email || parsed.isActive === false) return null;
    return stripPasswordHash(parsed);
  } catch {
    return null;
  }
}

let snapshotRaw: string | null = null;
let snapshotValue: SessionUser | null = null;

export function getSessionSnapshot(): SessionUser | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotValue = getSession();
  }
  return snapshotValue;
}

export function getServerSessionSnapshot(): SessionUser | null {
  return null;
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

async function apiJson<T>(
  url: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    field?: AuthField;
  } & T;

  if (!response.ok) {
    throw new AuthError(
      payload.error ?? "Something went wrong. Try again.",
      payload.field,
    );
  }

  return payload;
}

let inFlightSessionRefresh: Promise<SessionUser | null> | null = null;

export async function refreshSessionFromServer(): Promise<SessionUser | null> {
  if (!canUseStorage()) return null;
  if (inFlightSessionRefresh) return inFlightSessionRefresh;

  inFlightSessionRefresh = (async () => {
    try {
      const payload = await apiJson<{ user: SessionUser | null }>(
        "/api/auth/session",
        "GET",
      );
      setCachedSession(payload.user ?? null);
      return payload.user ?? null;
    } catch {
      return getSession();
    } finally {
      inFlightSessionRefresh = null;
    }
  })();

  return inFlightSessionRefresh;
}

let inFlightUsersRefresh: Promise<SessionUser[]> | null = null;

export async function refreshUsersFromServer(): Promise<SessionUser[]> {
  if (!canUseStorage()) return [];
  if (inFlightUsersRefresh) return inFlightUsersRefresh;

  inFlightUsersRefresh = (async () => {
    try {
      const payload = await apiJson<{ users: SessionUser[] }>(
        "/api/admin/users",
        "GET",
      );
      writeCachedUsers(payload.users);
      return payload.users;
    } finally {
      inFlightUsersRefresh = null;
    }
  })();

  return inFlightUsersRefresh;
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

  const { user } = await apiJson<{ user: SessionUser }>(
    "/api/auth/register",
    "POST",
    input,
  );
  setCachedSession(user);
  return user;
}

export async function signIn(
  email: string,
  password: string,
): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    throw new AuthError("Enter your email and password.", "email");
  }

  const { user } = await apiJson<{ user: SessionUser }>(
    "/api/auth/login",
    "POST",
    { email: normalized, password },
  );
  setCachedSession(user);
  return user;
}

export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    });
  } catch {
    // Still clear client cache if network is unavailable.
  } finally {
    setCachedSession(null);
  }
}

export type ProfileInput = {
  fullName: string;
  phone: string;
  address?: string;
  emergencyContact?: string;
};

export async function updateProfile(input: ProfileInput): Promise<SessionUser> {
  if (input.fullName.trim().length < 2) {
    throw new AuthError("Enter your full name.", "fullName");
  }

  const { user } = await apiJson<{ user: SessionUser }>(
    "/api/auth/profile",
    "PATCH",
    input,
  );
  setCachedSession(user);
  return user;
}

export async function changePassword(
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const issue = passwordIssue(nextPassword);
  if (issue) throw new AuthError(issue, "password");

  await apiJson<{ ok: boolean }>("/api/auth/password", "POST", {
    currentPassword,
    nextPassword,
  });
}

export async function updateUserRole(
  userId: string,
  role: Role,
): Promise<SessionUser> {
  const { user } = await apiJson<{ user: SessionUser }>(
    "/api/admin/users",
    "PATCH",
    { userId, role },
  );
  upsertCachedUser(user);
  return user;
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<SessionUser> {
  const { user } = await apiJson<{ user: SessionUser }>(
    "/api/admin/users",
    "PATCH",
    { userId, isActive },
  );
  upsertCachedUser(user);
  return user;
}

export type UserSummary = {
  total: number;
  staff: number;
  customers: number;
  active: number;
  suspended: number;
};

/** Every cached account, newest first — password digests are never present. */
export function listUsers(): SessionUser[] {
  return readCachedUsers().sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

const EMPTY_USERS: SessionUser[] = [];
let cachedSeedSummary: SessionUser[] | null = null;
let usersSnapshotRaw: string | null = null;
let usersSnapshotValue: SessionUser[] = EMPTY_USERS;

function initialSeedSummary(): SessionUser[] {
  cachedSeedSummary ??= seedSummaries();
  return cachedSeedSummary;
}

export function getUsersSnapshot(): SessionUser[] {
  if (!canUseStorage()) return EMPTY_USERS;

  const raw = window.localStorage.getItem(USERS_KEY);
  if (raw !== usersSnapshotRaw) {
    usersSnapshotRaw = raw;
    usersSnapshotValue = raw ? listUsers() : initialSeedSummary();
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
