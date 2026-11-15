"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  changePassword as changePasswordRecord,
  getServerSessionSnapshot,
  getSessionSnapshot,
  register as registerRecord,
  signIn as signInRecord,
  signOut as signOutRecord,
  subscribe,
  updateProfile as updateProfileRecord,
  type ProfileInput,
  type RegisterInput,
  type SessionUser,
} from "@/lib/auth";

type AuthValue = {
  user: SessionUser | null;
  /** False until the stored session has been read on the client. */
  ready: boolean;
  register: (input: RegisterInput) => Promise<SessionUser>;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  /**
   * Clear the session and leave the protected screen. Defaults to the sign-in
   * page; pass a path to land somewhere else (for example `/`).
   */
  signOut: (redirectTo?: string) => void;
  updateProfile: (input: ProfileInput) => SessionUser;
  changePassword: (current: string, next: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const noopSubscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // The session lives in localStorage, so it is read as an external store —
  // every tab re-renders when the account or session key changes.
  const user = useSyncExternalStore(
    subscribe,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const ready = useSyncExternalStore(noopSubscribe, clientReady, serverReady);

  const register = useCallback(async (input: RegisterInput) => {
    return registerRecord(input);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    return signInRecord(email, password);
  }, []);

  const signOut = useCallback(
    (redirectTo = "/login?signedOut=1") => {
      signOutRecord();

      // Full navigation, not `router.replace`: the protected screen must not
      // get a chance to run its "no session" guard (which would rewrite the
      // URL with `?next=`) before the sign-in page renders.
      if (typeof window !== "undefined") {
        window.location.replace(redirectTo);
      } else {
        router.replace(redirectTo);
      }
    },
    [router],
  );

  const updateProfile = useCallback((input: ProfileInput) => {
    return updateProfileRecord(input);
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    await changePasswordRecord(current, next);
  }, []);

  const value = useMemo(
    () => ({ user, ready, register, signIn, signOut, updateProfile, changePassword }),
    [user, ready, register, signIn, signOut, updateProfile, changePassword],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
