/**
 * Typed view of `supabase/schema.sql` for `@supabase/supabase-js`.
 *
 * Hand-maintained because the project has no live Supabase project yet. When
 * one exists, regenerate from the CLI and replace this file:
 *
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts
 *
 * Keep it in step with `supabase/schema.sql` — the eight tables and nine
 * enums are the whole surface the app touches.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "visitor";
export type ConservationStatus = "CR" | "EN" | "VU" | "NT" | "LC" | "DD";
export type Seasonality = "RESIDENT" | "MIGRATORY" | "SEASONAL";
export type TourDifficulty = "EASY" | "MODERATE" | "CHALLENGING";
export type InquiryStatus =
  | "PENDING"
  | "ON_PROCESS"
  | "CONTACTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";
export type PaymentMethod = "GCASH" | "MAYA" | "BANK_TRANSFER" | "ON_SITE_CASH";
export type PaymentStatus =
  | "UNPAID"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REFUNDED";
export type AdvisorySeverity = "CRITICAL" | "WARNING" | "INFO";
export type AdvisoryCategory = "Wildlife" | "Water" | "Access" | "Operations";
export type SubscriberStatus = "ACTIVE" | "UNSUBSCRIBED";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

type SpeciesRow = {
  id: string;
  category_id: string;
  common_name: string;
  local_name: string | null;
  scientific_name: string;
  conservation_status: ConservationStatus;
  seasonality: Seasonality;
  habitat: string;
  description: string;
  featured_image: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

type TourRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string;
  duration: string;
  departure: string;
  rate_per_person: number;
  max_capacity: number;
  difficulty: TourDifficulty;
  inclusions: string[];
  what_to_bring: string[];
  notes: string[];
  species_slugs: string[];
  itinerary: Json;
  tariff: Json;
  featured_image: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TourInquiryRow = {
  id: string;
  reference_code: string;
  tour_id: string;
  tour_slug: string | null;
  tour_title: string | null;
  user_id: string | null;
  user_email: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  target_date: string;
  party_size: number;
  notes: string | null;
  status: InquiryStatus;
  on_process_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  decided_by: "visitor" | "park" | null;
  rate_per_person: number;
  total_amount: number;
  first_payment_rate: number;
  first_payment_amount: number;
  balance_amount: number;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  payment_account_name: string | null;
  payment_proof_url: string | null;
  payment_status: PaymentStatus;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  admin_note: string | null;
  timeline: Json;
  messages: Json;
  created_at: string;
  updated_at: string;
};

type AdvisoryRow = {
  id: string;
  author_id: string | null;
  title: string;
  slug: string;
  severity: AdvisorySeverity;
  category: AdvisoryCategory;
  excerpt: string;
  content: string;
  effective_until: string | null;
  actions: string[];
  is_active_banner: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
};

type SubscriberRow = {
  id: string;
  email: string;
  status: SubscriberStatus;
  topics: string[];
  subscribed_at: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  role: UserRole;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

type PortalKvRow = {
  key: string;
  value: Json;
  updated_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: Table<
        UserRow,
        Omit<
          UserRow,
          | "id"
          | "role"
          | "is_active"
          | "created_at"
          | "last_login_at"
          | "phone"
          | "address"
          | "emergency_contact"
        > &
          Partial<
            Pick<
              UserRow,
              | "id"
              | "role"
              | "is_active"
              | "created_at"
              | "last_login_at"
              | "phone"
              | "address"
              | "emergency_contact"
            >
          >
      >;
      categories: Table<CategoryRow, Omit<CategoryRow, "id" | "sort_order" | "created_at"> & Partial<Pick<CategoryRow, "id" | "sort_order" | "created_at">>>;
      species: Table<
        SpeciesRow,
        Omit<SpeciesRow, "id" | "created_at" | "updated_at"> &
          Partial<Pick<SpeciesRow, "id" | "created_at" | "updated_at">>
      >;
      tours: Table<
        TourRow,
        Omit<TourRow, "id" | "is_active" | "created_at" | "updated_at"> &
          Partial<Pick<TourRow, "id" | "is_active" | "created_at" | "updated_at">>
      >;
      tour_inquiries: Table<
        TourInquiryRow,
        Pick<
          TourInquiryRow,
          "reference_code" | "tour_id" | "full_name" | "email" | "target_date" | "party_size"
        > &
          Partial<
            Omit<
              TourInquiryRow,
              "reference_code" | "tour_id" | "full_name" | "email" | "target_date" | "party_size"
            >
          >
      >;
      advisories: Table<
        AdvisoryRow,
        Omit<
          AdvisoryRow,
          | "id"
          | "category"
          | "effective_until"
          | "actions"
          | "is_active_banner"
          | "published_at"
          | "created_at"
          | "updated_at"
        > &
          Partial<
            Pick<
              AdvisoryRow,
              | "id"
              | "category"
              | "effective_until"
              | "actions"
              | "is_active_banner"
              | "published_at"
              | "created_at"
              | "updated_at"
            >
          >
      >;
      subscribers: Table<
        SubscriberRow,
        Omit<SubscriberRow, "id" | "status" | "subscribed_at"> &
          Partial<Pick<SubscriberRow, "id" | "status" | "subscribed_at">>
      >;
      portal_kv: Table<
        PortalKvRow,
        Omit<PortalKvRow, "updated_at"> & Partial<Pick<PortalKvRow, "updated_at">>
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
      conservation_status: ConservationStatus;
      seasonality: Seasonality;
      tour_difficulty: TourDifficulty;
      inquiry_status: InquiryStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      advisory_severity: AdvisorySeverity;
      subscriber_status: SubscriberStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
