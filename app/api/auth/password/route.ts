import { NextResponse } from "next/server";
import {
  authErrorResponse,
  changeCurrentUserPassword,
  requireSession,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { error: "Your session has ended. Sign in again." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON payload." }, { status: 400 });
  }

  try {
    await changeCurrentUserPassword(
      session,
      String(body.currentPassword ?? ""),
      String(body.nextPassword ?? ""),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "Could not update your password.");
  }
}
