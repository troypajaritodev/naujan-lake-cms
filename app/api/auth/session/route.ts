import { NextResponse } from "next/server";
import { clearSessionCookie, getServerSession } from "@/lib/server-auth";

export async function GET() {
  const user = await getServerSession();
  const response = NextResponse.json(
    { user },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (!user) {
    clearSessionCookie(response);
  }
  return response;
}
