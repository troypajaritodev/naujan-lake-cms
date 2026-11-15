import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  authErrorResponse,
  registerVisitorAccount,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON payload." }, { status: 400 });
  }

  try {
    const user = await registerVisitorAccount({
      fullName: String(body.fullName ?? ""),
      email: String(body.email ?? ""),
      phone: body.phone ? String(body.phone) : "",
      password: String(body.password ?? ""),
      confirmPassword: String(body.confirmPassword ?? ""),
    });
    const response = NextResponse.json({ user }, { status: 201 });
    return await attachSessionCookie(response, user);
  } catch (error) {
    return authErrorResponse(error, "Unable to create account.");
  }
}
