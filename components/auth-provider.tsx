"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  changePassword as changePasswordRecord,
  getServerSessionSnapshot,
  getSessionSnapshot,
  refreshSessionFromServer,
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
  /** False until the HttpOnly server session has been verified on the client. */
  ready: boolean;
  register: (input: RegisterInput) => Promise<SessionUser>;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  /**
   * Clear the HttpOnly session cookie and leave the protected screen.
   */
  signOut: (redirectTo?: string) => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<SessionUser>;
  changePassword: (current: string, next: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useSyncExternalStore(
    subscribe,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    refreshSessionFromServer().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    return registerRecord(input);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    return signInRecord(email, password);
  }, []);

  const signOut = useCallback(
    async (redirectTo = "/login?signedOut=1") => {
      await signOutRecord();

      if (typeof window !== "undefined") {
        window.location.replace(redirectTo);
      } else {
        router.replace(redirectTo);
      }
    },
    [router],
  );

  const updateProfile = useCallback(async (input: ProfileInput) => {
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
    throw new Error("useAuth must be called inside <AuthProvider>.");
  }
  return context;
}
