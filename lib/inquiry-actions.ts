"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { inquiryConfirmationEmail, inquiryNotificationEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { cleanEmail, cleanPhone, cleanText } from "@/lib/sanitize";
import { getSupabaseAdminClient, getSupabaseAdminSigningKey } from "@/lib/supabase/admin";
import type { Inquiry } from "@/lib/inquiries";

export type CreateInquiryInput = {
  submissionToken: string;
  fullName: string;
  email: string;
  phone: string;
  tourSlug: string;
  preferredDate: string;
  partySize: number;
  message: string;
};

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const recentSubmissions = new Map<string, number[]>();

function todayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isRealDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

async function enforceRateLimit(): Promise<void> {
  const requestHeaders = await headers();
  const key = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")?.trim()
    || "unknown";
  const now = Date.now();
  const recent = (recentSubmissions.get(key) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= MAX_SUBMISSIONS_PER_WINDOW) {
    throw new Error("Too many inquiries from this connection. Please try again later.");
  }
  recent.push(now);
  recentSubmissions.set(key, recent);
}

function referenceFor(token: string, input: Omit<CreateInquiryInput, "submissionToken">): string {
  const canonical = [
    token,
    cleanText(input.fullName, 120),
    cleanEmail(input.email),
    cleanPhone(input.phone),
    cleanText(input.tourSlug, 120),
    cleanText(input.preferredDate, 10),
    String(Number(input.partySize)),
    cleanText(input.message, 2000),
  ].join("\u001f");
  const digest = createHmac("sha256", getSupabaseAdminSigningKey())
    .update(`inquiry:${canonical}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  return `NL-${cleanText(input.preferredDate, 4)}-${digest}`;
}

function asInquiry(row: {
  id: string;
  reference_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  target_date: string;
  party_size: number;
  notes: string | null;
  status: Inquiry["status"];
  created_at: string;
  tour: { slug: string; title: string };
}): Inquiry {
  return {
    id: row.id,
    reference: row.reference_code,
    userEmail: row.email,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    tourSlug: row.tour.slug,
    tourTitle: row.tour.title,
    preferredDate: row.target_date,
    partySize: row.party_size,
    message: row.notes ?? "",
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function createSupabaseInquiry(input: CreateInquiryInput): Promise<Inquiry> {
  await enforceRateLimit();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.submissionToken)) {
    throw new Error("This inquiry could not be submitted. Please try again.");
  }

  const fullName = cleanText(input.fullName, 120);
  const email = cleanEmail(input.email);
  const phone = cleanPhone(input.phone);
  const tourSlug = cleanText(input.tourSlug, 120);
  const preferredDate = cleanText(input.preferredDate, 10);
  const message = cleanText(input.message, 2000);
  const partySize = Number(input.partySize);

  if (!fullName) throw new Error("Enter the name for the booking.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error("Enter a valid email so the park office can reply.");
  }
  if (!isRealDate(preferredDate) || preferredDate < todayInManila()) {
    throw new Error("Choose a date from today onwards.");
  }
  if (!Number.isInteger(partySize) || partySize < 1) {
    throw new Error("Choose a valid number of guests.");
  }
  if (!tourSlug) throw new Error("Choose a package.");

  const client = getSupabaseAdminClient();
  const reference = referenceFor(input.submissionToken, {
    fullName,
    email,
    phone,
    tourSlug,
    preferredDate,
    partySize,
    message,
  });

  const { data: existing, error: existingError } = await client
    .from("tour_inquiries")
    .select("id, reference_code, tour_id, full_name, email, phone, target_date, party_size, notes, status, created_at")
    .eq("reference_code", reference)
    .maybeSingle();
  if (existingError) throw new Error(`Could not verify the inquiry submission: ${existingError.message}`);
  if (existing) {
    const { data: existingTour, error: existingTourError } = await client
      .from("tours")
      .select("slug, title")
      .eq("id", existing.tour_id)
      .single();
    if (existingTourError || !existingTour) {
      throw new Error("The selected tour could not be loaded.");
    }
    const sameSubmission =
      existing.full_name === fullName &&
      existing.email === email &&
      (existing.phone ?? "") === phone &&
      existing.target_date === preferredDate &&
      existing.party_size === partySize &&
      (existing.notes ?? "") === message &&
      existingTour.slug === tourSlug;
    if (!sameSubmission) {
      throw new Error("This inquiry could not be safely retried. Please start a new inquiry.");
    }
    return asInquiry({ ...existing, tour: existingTour });
  }

  const { data: tour, error: tourError } = await client
    .from("tours")
    .select("id, slug, title, max_capacity, is_active")
    .eq("slug", tourSlug)
    .maybeSingle();
  if (tourError) throw new Error(`Could not verify the selected package: ${tourError.message}`);
  if (!tour || !tour.is_active) throw new Error("That package is no longer available. Choose another package.");
  if (partySize > tour.max_capacity) {
    throw new Error(`This package takes 1 to ${tour.max_capacity} guests per booking.`);
  }

  const { data: row, error } = await client
    .from("tour_inquiries")
    .insert({
      reference_code: reference,
      tour_id: tour.id,
      user_id: null,
      full_name: fullName,
      email,
      phone: phone || null,
      target_date: preferredDate,
      party_size: partySize,
      notes: message || null,
      status: "PENDING",
    })
    .select("id, reference_code, tour_id, full_name, email, phone, target_date, party_size, notes, status, created_at")
    .single();

  if (error || !row) {
    if (error?.code === "23505") {
      const { data: raced } = await client
        .from("tour_inquiries")
        .select("id, reference_code, tour_id, full_name, email, phone, target_date, party_size, notes, status, created_at")
        .eq("reference_code", reference)
        .maybeSingle();
      if (raced && raced.tour_id === tour.id) {
        const sameSubmission =
          raced.full_name === fullName &&
          raced.email === email &&
          (raced.phone ?? "") === phone &&
          raced.target_date === preferredDate &&
          raced.party_size === partySize &&
          (raced.notes ?? "") === message;
        if (sameSubmission) return asInquiry({ ...raced, tour });
      }
    }
    throw new Error(`Could not save the inquiry: ${error?.message ?? "No inquiry was returned."}`);
  }

  const inquiry = asInquiry({ ...row, tour });
  const emailResults = await Promise.allSettled([
    sendEmail(inquiryConfirmationEmail(inquiry)),
    sendEmail(inquiryNotificationEmail(inquiry)),
  ]);
  for (const result of emailResults) {
    if (result.status === "rejected") {
      console.error("[inquiry-email] notification failed", {
        reference: inquiry.reference,
        error: result.reason instanceof Error ? result.reason.message : result.reason,
      });
    } else if (!result.value.delivered) {
      console.warn("[inquiry-email] notification was not delivered", {
        reference: inquiry.reference,
        reason: result.value.reason,
        detail: result.value.detail,
      });
    }
  }
  return inquiry;
}
