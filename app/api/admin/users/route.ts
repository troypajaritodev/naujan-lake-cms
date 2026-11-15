import { NextResponse } from "next/server";
import type { Role } from "@/lib/auth-seeds";
import {
  authErrorResponse,
  listServerUsers,
  requireAdminSession,
  setServerUserActive,
  updateServerUserRole,
} from "@/lib/server-auth";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: "Only park staff can view account records." },
      { status: 403 },
    );
  }

  const users = await listServerUsers();
  return NextResponse.json(
    { users },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: "Only park staff can update account records." },
      { status: 403 },
    );
  }

  let body: { userId?: unknown; role?: unknown; isActive?: unknown };
  try {
    body = (await request.json()) as {
      userId?: unknown;
      role?: unknown;
      isActive?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Expected JSON payload." }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  try {
    let user;
    if (body.role === "admin" || body.role === "visitor") {
      user = await updateServerUserRole(admin, userId, body.role as Role);
    } else if (typeof body.isActive === "boolean") {
      user = await setServerUserActive(admin, userId, body.isActive);
    } else {
      return NextResponse.json(
        { error: "Specify a valid role or active status update." },
        { status: 400 },
      );
    }
    return NextResponse.json({ user });
  } catch (error) {
    return authErrorResponse(error, "Could not update user account.");
  }
}
