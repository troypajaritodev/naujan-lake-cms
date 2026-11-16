import crypto from "node:crypto";

const GHOST_TIMEOUT_MS = 6000;
const META_SCRIPT_ID = "nl-cms-meta";

export type GhostTag = {
  id?: string;
  name: string;
  slug: string;
};

export type GhostPost = {
  id: string;
  uuid?: string;
  title: string;
  slug: string;
  html?: string | null;
  custom_excerpt?: string | null;
  excerpt?: string | null;
  feature_image?: string | null;
  feature_image_alt?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  status?: "published" | "draft" | "scheduled" | string;
  codeinjection_foot?: string | null;
  tags?: GhostTag[];
};

export type GhostStatus = {
  configured: boolean;
  contentApiReady: boolean;
  adminApiReady: boolean;
  webhookSecretReady: boolean;
  url: string | null;
  host: string | null;
  studioUrl: string | null;
  mode: "two-way" | "read-only" | "demo";
};

export function normalizeGhostUrl(raw?: string | null): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    const cleanPath = parsed.pathname.replace(/\/ghost\/?$/i, "").replace(/\/+$/g, "");
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return null;
  }
}

export function getGhostStatus(): GhostStatus {
  const url = normalizeGhostUrl(process.env.GHOST_URL);
  const contentKey = process.env.GHOST_CONTENT_API_KEY?.trim() ?? "";
  const adminKey = process.env.GHOST_ADMIN_API_KEY?.trim() ?? "";
  const webhookSecret = process.env.GHOST_WEBHOOK_SECRET?.trim() ?? "";

  const contentApiReady = Boolean(url && contentKey);
  const adminApiReady = Boolean(url && adminKey.includes(":"));
  const webhookSecretReady = Boolean(webhookSecret);
  const configured = contentApiReady || adminApiReady;

  let host: string | null = null;
  if (url) {
    try {
      host = new URL(url).host;
    } catch {
      host = url;
    }
  }

  return {
    configured,
    contentApiReady,
    adminApiReady,
    webhookSecretReady,
    url,
    host,
    studioUrl: url ? `${url}/ghost` : null,
    mode: contentApiReady && adminApiReady
      ? "two-way"
      : contentApiReady
        ? "read-only"
        : "demo",
  };
}

/** Generate an HS256 JWT accepted by the Ghost Admin API (`<id>:<hex_secret>`). */
export function createGhostAdminJwt(rawKey?: string): string {
  const key = (rawKey ?? process.env.GHOST_ADMIN_API_KEY ?? "").trim();
  const colon = key.indexOf(":");
  if (colon <= 0 || colon === key.length - 1) {
    throw new Error("Invalid GHOST_ADMIN_API_KEY format (expected id:secret).");
  }
  const id = key.slice(0, colon);
  const secretHex = key.slice(colon + 1);
  if (!/^[0-9a-f]+$/i.test(secretHex) || secretHex.length % 2 !== 0) {
    throw new Error("Invalid GHOST_ADMIN_API_KEY secret encoding.");
  }

  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }),
  ).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" }),
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", Buffer.from(secretHex, "hex"))
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export async function ghostContentFetch<T>(
  endpoint: string,
  query: Record<string, string> = {},
): Promise<T | null> {
  const url = normalizeGhostUrl(process.env.GHOST_URL);
  const key = process.env.GHOST_CONTENT_API_KEY?.trim();
  if (!url || !key) return null;

  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const params = new URLSearchParams({ key, ...query });

  try {
    const response = await fetch(
      `${url}/ghost/api/content/${cleanEndpoint}?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Version": "v5.0",
        },
        signal: AbortSignal.timeout(GHOST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[ghost] Content API ${cleanEndpoint} returned HTTP ${response.status}`);
      }
      return null;
    }
    return (await response.json()) as T;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[ghost] Content API ${cleanEndpoint} unreachable — using fallback.`,
        err instanceof Error ? err.message : err,
      );
    }
    return null;
  }
}

export type GhostAdminResponse<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export async function ghostAdminFetch<T>(
  endpoint: string,
  options?: { method?: string; body?: unknown },
): Promise<GhostAdminResponse<T>> {
  const url = normalizeGhostUrl(process.env.GHOST_URL);
  const adminKey = process.env.GHOST_ADMIN_API_KEY?.trim();
  if (!url || !adminKey) {
    return {
      ok: false,
      status: 503,
      error: "Ghost Admin API is not configured.",
    };
  }

  let jwt: string;
  try {
    jwt = createGhostAdminJwt(adminKey);
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Invalid Ghost Admin key.",
    };
  }

  const cleanEndpoint = endpoint.replace(/^\/+/, "");

  try {
    const response = await fetch(`${url}/ghost/api/admin/${cleanEndpoint}`, {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Ghost ${jwt}`,
        Accept: "application/json",
        "Accept-Version": "v5.0",
        ...(options?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(options?.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
      signal: AbortSignal.timeout(GHOST_TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      errors?: { message?: string; context?: string }[];
    } & T;

    if (!response.ok) {
      const detail =
        payload.errors?.[0]?.context ||
        payload.errors?.[0]?.message ||
        `Ghost Admin API returned HTTP ${response.status}`;
      return { ok: false, status: response.status, error: detail };
    }

    return { ok: true, status: response.status, data: payload as T };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error:
        err instanceof Error
          ? err.message
          : "Unable to reach Ghost Admin API.",
    };
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies Ghost webhook authenticity via `X-Ghost-Signature` (`sha256=<hex>, t=<ms>`)
 * or fallback header secret. Fails closed if `GHOST_WEBHOOK_SECRET` is unset.
 */
export function verifyGhostWebhookRequest(input: {
  rawBody: string;
  signatureHeader?: string | null;
  secretHeader?: string | null;
}): boolean {
  const secret = process.env.GHOST_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  if (input.secretHeader && constantTimeEquals(input.secretHeader.trim(), secret)) {
    return true;
  }

  const sigRaw = input.signatureHeader?.trim();
  if (!sigRaw) return false;

  const parts = sigRaw.split(",").map((part) => part.trim());
  const shaPart = parts.find((p) => p.startsWith("sha256="));
  const timePart = parts.find((p) => p.startsWith("t="));

  if (!shaPart) return false;
  const providedHex = shaPart.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(providedHex)) return false;

  const timestampStr = timePart ? timePart.slice(2).trim() : "";
  if (timestampStr) {
    const ts = Number(timestampStr);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 300_000) {
      return false;
    }
  }

  const expectedWithTs = crypto
    .createHmac("sha256", secret)
    .update(`${input.rawBody}${timestampStr}`)
    .digest("hex")
    .toLowerCase();

  if (constantTimeEquals(providedHex, expectedWithTs)) return true;

  if (timestampStr) {
    const expectedRawOnly = crypto
      .createHmac("sha256", secret)
      .update(input.rawBody)
      .digest("hex")
      .toLowerCase();
    return constantTimeEquals(providedHex, expectedRawOnly);
  }

  return false;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function encodeGhostMeta(meta: Record<string, unknown>): string {
  const json = JSON.stringify(meta).replace(/<\/script/gi, "<\\/script");
  return `<script type="application/json" id="${META_SCRIPT_ID}">${json}</script>`;
}

export function decodeGhostMeta<T extends Record<string, unknown>>(
  codeinjectionFoot: string | null | undefined,
): Partial<T> | null {
  if (!codeinjectionFoot) return null;
  const regex = new RegExp(
    `<script[^>]*id=["']${META_SCRIPT_ID}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    "i",
  );
  const match = regex.exec(codeinjectionFoot);
  if (!match?.[1]) return null;
  try {
    const decoded: unknown = JSON.parse(match[1].replace(/<\\\/script/gi, "</script"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return null;
    }
    return decoded as Partial<T>;
  } catch {
    return null;
  }
}

export function paragraphsToHtml(paragraphs: readonly string[]): string {
  return paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function htmlToParagraphs(html: string | null | undefined): string[] {
  if (!html) return [];
  const normalized = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|blockquote|div)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");

  return decodeBasicEntities(normalized)
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
