import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  authenticateUser,
  authErrorResponse,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected JSON payload." }, { status: 400 });
  }

  try {
    const user = await authenticateUser(
      String(body.email ?? ""),
      String(body.password ?? ""),
    );
    const response = NextResponse.json({ user });
    return await attachSessionCookie(response, user);
  } catch (error) {
    return authErrorResponse(error, "Unable to sign in.");
  }
}
