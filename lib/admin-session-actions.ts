"use server";

import {
  clearAdminSession,
  createAdminSession,
} from "@/lib/admin-session";

export async function startAdminSessionAction(email: string, password: string) {
  await createAdminSession(email, password);
}

export async function endAdminSessionAction() {
  await clearAdminSession();
}
