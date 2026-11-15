import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  authErrorResponse,
  requireSession,
  updateCurrentUserProfile,
} from "@/lib/server-auth";

export async function PATCH(request: Request) {
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
    const user = await updateCurrentUserProfile(session, {
      fullName: String(body.fullName ?? ""),
      phone: String(body.phone ?? ""),
      address: body.address !== undefined ? String(body.address) : undefined,
      emergencyContact:
        body.emergencyContact !== undefined
          ? String(body.emergencyContact)
          : undefined,
    });
    const response = NextResponse.json({ user });
    return await attachSessionCookie(response, user);
  } catch (error) {
    return authErrorResponse(error, "Could not save your profile.");
  }
}
