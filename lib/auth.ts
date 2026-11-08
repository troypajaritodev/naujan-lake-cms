/**
 * Visitor accounts and session handling (Requirement B + G).
 *
 * This build has no server, so accounts live in `localStorage` and the
 * password is stored as a salted SHA-256 digest — never in clear text.
 * Swapping this module for Supabase auth later keeps the same public API.
 */

export type Role = "admin" | "visitor";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  createdAt: string;
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
  };
}

export function getSession(): SessionUser | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { id?: string };
    if (!parsed?.id) return null;

    // Re-read the record so a renamed profile or role change is reflected.
    const stored = readUsers().find((user) => user.id === parsed.id);
    return stored ? toSessionUser(stored) : null;
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

  const user = readUsers().find((entry) => entry.email === normalized);
  if (!user) {
    throw new AuthError("No account matches that email.", "email");
  }

  const digest = await hashPassword(normalized, password);
  if (digest !== user.passwordHash) {
    throw new AuthError("That password is not correct.", "password");
  }

  setSession(user);
  return toSessionUser(user);
}

export function signOut() {
  setSession(null);
}

export type ProfileInput = {
  fullName: string;
  phone: string;
};

export function updateProfile({ fullName, phone }: ProfileInput): SessionUser {
  const session = getSession();
  if (!session) throw new AuthError("Your session has ended. Sign in again.");

  const name = fullName.trim();
  if (name.length < 2) throw new AuthError("Enter your full name.", "fullName");

  const users = readUsers().map((user) =>
    user.id === session.id ? { ...user, fullName: name, phone: phone.trim() } : user,
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
