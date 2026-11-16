import { NextResponse } from "next/server";
import { getServerSession, requireAdminSession } from "@/lib/server-auth";
import {
  isServerSubscribed,
  listServerSubscribers,
  setServerSubscriberStatus,
  subscribeServer,
  unsubscribeServer,
} from "@/lib/server-subscribers";
import { SubscribeError } from "@/lib/subscribers-shared";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const recentRequests = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recentRequests.get(key) ?? []).filter(
    (at) => now - at < WINDOW_MS,
  );
  hits.push(now);
  recentRequests.set(key, hits);
  return hits.length > MAX_PER_WINDOW;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("mine") === "1") {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ subscribed: false });
    }
    const subscribed = await isServerSubscribed(session.email);
    return NextResponse.json({ subscribed });
  }

  const admin = await requireAdminSession();
  if (!admin) {
    const session = await getServerSession();
    return NextResponse.json(
      { error: session ? "Park staff clearance required." : "Sign in required." },
      { status: session ? 403 : 401 },
    );
  }

  const subscribers = await listServerSubscribers();
  return NextResponse.json({ subscribers });
}

export async function POST(request: Request) {
  const clientKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { error: "Too many subscription requests. Try again shortly." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  if (body.action === "unsubscribe") {
    const removed = await unsubscribeServer(
      typeof body.email === "string" ? body.email : "",
    );
    return NextResponse.json({ ok: true, removed });
  }

  try {
    const result = await subscribeServer(
      typeof body.email === "string" ? body.email : "",
      body.topics,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    if (err instanceof SubscribeError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Could not save your subscription right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    const session = await getServerSession();
    return NextResponse.json(
      { error: session ? "Park staff clearance required." : "Sign in required." },
      { status: session ? 403 : 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const status =
    body.status === "ACTIVE" || body.status === "UNSUBSCRIBED"
      ? body.status
      : null;

  if (!id || !status) {
    return NextResponse.json(
      { error: "Subscriber ID and valid status are required." },
      { status: 400 },
    );
  }

  const subscribers = await setServerSubscriberStatus(id, status);
  return NextResponse.json({ ok: true, subscribers });
}
