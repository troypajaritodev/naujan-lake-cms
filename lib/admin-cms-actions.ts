"use server";

import { requireAdminClient } from "@/lib/admin-session";
import { inquiryDecisionEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import type { Inquiry, InquiryStatus } from "@/lib/inquiries";
import type { SessionUser } from "@/lib/auth";

export async function listAdminUsersAction(): Promise<SessionUser[]> {
  const client = await requireAdminClient();
  const { data, error } = await client
    .from("users")
    .select("id, email, full_name, phone, role, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load users: ${error.message}`);

  return (data ?? []).map((user) => ({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone ?? "",
    role: user.role,
    createdAt: user.created_at,
  }));
}

export async function listAdminInquiriesAction(): Promise<Inquiry[]> {
  const client = await requireAdminClient();
  const { data, error } = await client
    .from("tour_inquiries")
    .select(
      "id, reference_code, user_id, full_name, email, phone, target_date, party_size, notes, status, created_at, tour_id",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load inquiries: ${error.message}`);
  if (!data?.length) return [];

  const tourIds = [...new Set(data.map((inquiry) => inquiry.tour_id))];
  const { data: tours, error: toursError } = await client
    .from("tours")
    .select("id, slug, title")
    .in("id", tourIds);

  if (toursError) throw new Error(`Could not load inquiry tours: ${toursError.message}`);

  const toursById = new Map((tours ?? []).map((tour) => [tour.id, tour]));

  return data.map((inquiry) => {
    const tour = toursById.get(inquiry.tour_id);
    if (!tour) {
      throw new Error(`Inquiry ${inquiry.reference_code} references a missing tour.`);
    }

    return {
      id: inquiry.id,
      reference: inquiry.reference_code,
      userEmail: inquiry.email,
      fullName: inquiry.full_name,
      email: inquiry.email,
      phone: inquiry.phone ?? "",
      tourSlug: tour.slug,
      tourTitle: tour.title,
      preferredDate: inquiry.target_date,
      partySize: inquiry.party_size,
      message: inquiry.notes ?? "",
      status: inquiry.status,
      createdAt: inquiry.created_at,
    };
  });
}

export async function updateAdminInquiryStatusAction(
  id: string,
  status: InquiryStatus,
): Promise<void> {
  if (!id) throw new Error("Choose an inquiry to update.");
  if (!["PENDING", "CONTACTED", "CONFIRMED", "DECLINED"].includes(status)) {
    throw new Error("Choose a valid inquiry status.");
  }

  const client = await requireAdminClient();
  const { data: existing, error: existingError } = await client
    .from("tour_inquiries")
    .select(
      "id, reference_code, full_name, email, phone, target_date, party_size, notes, status, created_at, tour_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Could not load inquiry: ${existingError.message}`);
  }
  if (!existing) throw new Error("This inquiry no longer exists.");
  if (existing.status === status) return;

  const { data: tour, error: tourError } = await client
    .from("tours")
    .select("slug, title")
    .eq("id", existing.tour_id)
    .single();

  if (tourError || !tour) {
    throw new Error(`Could not load the tour for inquiry ${existing.reference_code}.`);
  }

  const inquiry: Inquiry = {
    id: existing.id,
    reference: existing.reference_code,
    userEmail: existing.email,
    fullName: existing.full_name,
    email: existing.email,
    phone: existing.phone ?? "",
    tourSlug: tour.slug,
    tourTitle: tour.title,
    preferredDate: existing.target_date,
    partySize: existing.party_size,
    message: existing.notes ?? "",
    status: existing.status,
    createdAt: existing.created_at,
  };

  const { data, error } = await client
    .from("tour_inquiries")
    .update({ status })
    .eq("id", id)
    .eq("status", existing.status)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not update inquiry status: ${error.message}`);
  if (!data) throw new Error("This inquiry changed while you were updating it. Refresh and try again.");

  if (status !== "CONFIRMED" && status !== "DECLINED") return;

  const result = await sendEmail(inquiryDecisionEmail({ ...inquiry, status }, status));
  if (!result.delivered) {
    console.warn("[inquiry-email] decision notification was not delivered", {
      reference: inquiry.reference,
      status,
      reason: result.reason ?? "unknown",
    });
  } else {
    console.info("[inquiry-email] decision notification delivered", {
      reference: inquiry.reference,
      status,
      providerMessageId: result.detail,
    });
  }
}
