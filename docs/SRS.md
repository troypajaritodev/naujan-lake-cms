# System Requirements Specification (SRS)
## Naujan Lake Eco-Tourism & Wildlife Information Management System

- **Project Title:** Startup-Oriented Web Application Development with CMS and System Integration
- **System Name:** Naujan Lake Eco-Tourism & Wildlife Information Management System (Visitor Hub & Admin CMS)
- **Course:** Web Systems and Technologies 2 · System Integration and Architecture 1
- **Target Site:** Naujan Lake National Park (Ramsar Site No. 1008), Oriental Mindoro, Philippines
- **Version:** 1.0 · November 2026
- **Related Documents:** [Business Model & Revenue Plan](./REVENUE_MODEL.md) · [System Design Document](./SYSTEM_DESIGN.md) · [Product Requirements Document](./PRD.md) · [Database Schema](../supabase/schema.sql)

---

## 1. Introduction

### 1.1 Purpose
This System Requirements Specification (SRS) defines the functional, non-functional, integration, database, security, and role-based requirements for the **Naujan Lake Eco-Tourism & Wildlife Information Management System**. It serves as the technical blueprint for development, system integration, testing, and capstone defense evaluation.

### 1.2 Project Overview
Naujan Lake National Park operates in an informal tourism environment where boat tariffs are unstandardized, visitor inquiries arrive via fragmented social media threads, ecological zoning rules are rarely read prior to arrival, and park staff lack a non-technical CMS to update advisories, wildlife records, or pricing.

The system solves these problems through three connected layers:
1. **Public Visitor & Biodiversity Portal** — Responsive web storefront presenting wildlife biodiversity records, published tour tariffs, park guidelines/zoning, and live park advisories.
2. **Transaction, Deposit & Visitor Account Portal** — Online booking request workflow supporting mandatory first-payment downpayments, live stage-by-stage booking tracking, visitor–park messaging, and scannable **QR Code Digital Boarding Passes**.
3. **CMS-Based Administrative Panel** — Role-protected staff dashboard enabling non-technical park administrators to manage advisories, tour packages, wildlife catalogue entries, park rules & lake zoning, user accounts, newsletter subscribers, and CSV operational reports.

### 1.3 Stakeholders & User Classes
- **Visitors / Eco-Tourists (`visitor`):** Browse wildlife and tour packages, register/sign in, submit bookings with first-payment proofs, message rangers, track booking status, and present QR boarding passes at the jetty.
- **Park Administrators / Rangers (`admin`):** Authenticate into `/admin`, triage incoming bookings and deposit proofs (`Pending -> On Process -> Confirmed -> Completed`), communicate with guests, manage CMS content (`Advisories`, `Packages`, `Wildlife`, `Rules & Zones`), manage user roles/status, and export operational CSV reports.
- **Accredited Boat Operators & Guides (Indirect Beneficiary):** Receive qualified, pre-briefed passenger manifests with verified deposits from the park queue.

---

## 2. Objectives

1. **Standardize Eco-Tourism Operations:** Replace informal social media inquiries with a structured online booking and 30% first-payment deposit workflow tied to unique booking reference codes (`INQ-XXXX`).
2. **Deliver a Multi-Module Public & Account Portal:** Provide visitor authentication, profile management, real-time booking stage tracking (`Pending` -> `On Process` -> `Confirmed` -> `Completed`), in-app messaging, and printable QR passes.
3. **Empower Staff with a Full Admin CMS:** Give park administrators zero-code tools to create, edit, reorder, archive, and restore public website content across Advisories, Tour Packages, Wildlife Species, and Park Rules & Lake Zoning.
4. **Apply Multi-Channel System Integration:** Integrate cloud relational database design (**Supabase PostgreSQL**), automated email templates (**Resend REST API**), **QR Code generation & verification**, live **Open-Meteo Weather API** conditions, and an **Interactive Lake Map**.
5. **Enforce Baseline Application Security:** Implement role-based authorization (`admin` vs. `visitor`), salted password hashing, strict server-side input sanitization/validation, and defensive security headers.
6. **Demonstrate a Sustainable Revenue Model:** Support booking facilitation fees (₱150/booking), accredited operator commissions (8%), and ancillary park monetization channels documented in [REVENUE_MODEL.md](./REVENUE_MODEL.md).

---

## 3. Scope

### 3.1 In Scope
- **Public Modules (`/`, `/wildlife`, `/wildlife/[slug]`, `/tours`, `/tours/[slug]`, `/advisories`, `/advisories/[slug]`, `/guidelines`, `/subscribe`):**
  - Searchable/filterable wildlife catalogue grouped across 5 taxonomic categories with IUCN conservation badges.
  - Tour catalogue showing duration, departure window, licensed passenger capacity, tariffs, and instant booking links.
  - Interactive Naujan Lake access-point & zoning map plus live local weather/boating safety feed on `/guidelines` and `/advisories`.
  - Newsletter subscription form for park updates.
- **Visitor Authentication & Self-Service Account (`/register`, `/login`, `/account`, `/inquire`, `/verify`):**
  - Account registration, login, session persistence, profile editing (name, phone, address, emergency contact), and password updates.
  - Tour booking form with first-payment calculation (30% deposit vs. balance on arrival), payment method selection (`GCash`, `Maya`, `Bank Transfer`), payment reference, and optional receipt preview upload.
  - Live 4-step Booking Tracker (`Submitted / Pending`, `Accepted · On Process`, `Confirmed Ready`, `Completed`), direct Visitor ↔ Park Ranger message thread, and **QR Code Entry Pass** (`/verify?ref=...`).
- **Admin CMS Modules (`/admin`, `/admin/users`, `/admin/inquiries`, `/admin/subscribers`, `/admin/advisories`, `/admin/tours`, `/admin/species`, `/admin/rules`):**
  - KPI operations overview dashboard and one-click accept queue.
  - Booking, First-Payment Verification, Staff Dispatch Notes, Direct Messenger, QR Pass Verifier, and CSV Export.
  - User account creation, role switching (`admin`/`visitor`), suspension/reactivation, and CSV export.
  - Full CRUD / Archive / Restore CMS controls for Advisories, Tour Packages, Wildlife Species, and Park Rules & Zoning (`updateTag(...)` immediate public cache invalidation).

### 3.2 Out of Scope (Current Release Boundaries)
- Live payment gateway webhook settlement (PayMongo/Stripe sandbox webhooks are modeled via first-payment reference capture and admin verification).
- Automated cron-scheduled email campaigns (subscriber dispatch CSV and individual booking emails are supported directly).
- Server-side Supabase Auth middleware swap (documented as Phase 3 Milestone 4 in [BACKEND_STATUS.md](./BACKEND_STATUS.md); localStorage + salted SHA-256 demo auth currently mirrors the production schema contract).

---

## 4. Functional Requirements

### 4.1 User Authentication & Role Management
| ID | Requirement | Actor |
| :--- | :--- | :--- |
| **FR-1.1** | Visitors shall register using Full Name, Email, Phone Number, and Password (minimum 8 characters, with confirmation check). | Visitor |
| **FR-1.2** | Registered users shall sign in via email/password, establish an active session, and sign out cleanly to `/login?signedOut=1`. | Visitor / Admin |
| **FR-1.3** | Authenticated users shall edit profile details (contact number, address, emergency contact) and change passwords from `/account`. | Visitor / Admin |
| **FR-1.4** | Access to `/admin/*` screens shall be restricted to accounts with `role === "admin"`; visitor accounts or guests attempting access are redirected or shown an authorization gate. | Admin |

### 4.2 Public Portal & Biodiversity Discovery
| ID | Requirement | Actor |
| :--- | :--- | :--- |
| **FR-2.1** | The Home Page (`/`) shall summarize park highlights, active critical/pinned advisories, featured wildlife, tour rates, and visitor booking actions. | Public |
| **FR-2.2** | `/wildlife` shall display catalogued species across 5 taxonomic groups with search and filters for taxonomic group, IUCN conservation status (`CR`–`DD`), and seasonality. | Public |
| **FR-2.3** | `/tours` and `/tours/[slug]` shall show itemized tariffs, inclusions, capacity, departure schedule, and related wildlife sightings. | Public |
| **FR-2.4** | `/guidelines` shall present numbered park rules, the 3-zone area share breakdown (*Strict Protection*, *Sustainable Use*, *Buffer*), and an interactive **Naujan Lake Jetty & Zoning Map**. | Public |

### 4.3 Booking, First Payment, Tracking & Messaging
| ID | Requirement | Actor |
| :--- | :--- | :--- |
| **FR-3.1** | `/inquire` shall validate tour choice, preferred future date, party size, guest contact details, and compute **Total Tariff**, **First Payment Deposit (30%)**, and **Remaining Balance on Arrival**. | Visitor |
| **FR-3.2** | Visitors may submit deposit proof (`GCash`, `Maya`, or `Bank Transfer` reference code + optional receipt image) at booking time or later from `/account`. | Visitor |
| **FR-3.3** | `/account` shall display each booking's real-time tracker (`Pending` -> `On Process` -> `Confirmed` -> `Completed` / `Cancelled`), chronological audit timeline, and staff remarks. | Visitor |
| **FR-3.4** | Visitors and Admins shall exchange chronological messages directly on each booking thread, with instant UI visibility on both `/account` and `/admin/inquiries`. | Visitor / Admin |
| **FR-3.5** | Visitors may cancel eligible non-completed bookings from `/account`, updating status to `CANCELLED` (`decidedBy: "visitor"`) and freeing seats. | Visitor |

### 4.4 Admin CMS & Reporting
| ID | Requirement | Actor |
| :--- | :--- | :--- |
| **FR-4.1** | `/admin/inquiries` shall allow one-click **Accept & Move to On Process** (verifying first payment when settled), changing status, updating payment status (`UNPAID`, `PENDING_VERIFICATION`, `VERIFIED`, `REFUNDED`), posting dispatch notes, messaging guests, verifying QR passes, and **exporting bookings to CSV**. | Admin |
| **FR-4.2** | `/admin/advisories` shall publish, edit, pin-to-banner, archive, and restore safety/wildlife advisories with immediate reflection on `/advisories`. | Admin |
| **FR-4.3** | `/admin/tours` shall update package pricing, duration, departure windows, capacity, highlights, and publish/unpublish visibility on `/tours`. | Admin |
| **FR-4.4** | `/admin/species` shall add, edit, filter, archive, and restore wildlife species with group, IUCN status, seasonality, and reference photos on `/wildlife`. | Admin |
| **FR-4.5** | `/admin/rules` shall add, edit, reorder, delete, and reset park rules plus edit the 3 lake zones rendered on `/guidelines`. | Admin |
| **FR-4.6** | `/admin/users` and `/admin/subscribers` shall list registered accounts and subscribers, toggle role/suspension or subscription status, and **export reports to CSV**. | Admin |

### 4.5 System Integrations
| ID | Integration Type | Requirement |
| :--- | :--- | :--- |
| **FR-5.1** | **QR Code Digital Boarding Pass** | Accepted/confirmed bookings (`ON_PROCESS`, `CONFIRMED`, `COMPLETED`) shall generate a scannable **QR Code Entry Pass** linking to `/verify?ref=...` with booking reference, tour, departure date, party size, and deposit verification seal, inspectable both by guests (`/account`) and rangers (`/admin/inquiries`). |
| **FR-5.2** | **Email Notifications (Resend API)** | `/api/inquiries/notify` and `/api/inquiries/status` shall dispatch structured HTML notifications (`buildVisitorInquiryEmail`, `buildParkAlertEmail`, `buildStatusUpdateEmail`) when `RESEND_API_KEY` is configured and return clean skipped telemetry in demo mode. |
| **FR-5.3** | **Weather API (Open-Meteo)** | `/api/weather` shall retrieve live meteorological telemetry (temperature, humidity, wind speed, WMO weather condition, and computed boat safety advisory) for Naujan Lake (`13.168° N, 121.351° E`) with graceful cached fallback when offline. |
| **FR-5.4** | **Maps Integration (OpenStreetMap)** | `/guidelines` shall embed an interactive OpenStreetMap frame centered on Naujan Lake National Park with selectable jetty/zone pins and direct deep-link directions. |
| **FR-5.5** | **Cloud Database (Supabase)** | Public data modules (`lib/species.ts`, `lib/tours.ts`, `lib/advisories.ts`, `lib/subscribers.ts`) shall read from the 7-table PostgreSQL schema in `supabase/schema.sql` when env vars are live and seamlessly fall back offline otherwise. |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target / Mechanism |
| :--- | :--- | :--- |
| **Performance** | Fast initial render and instant CMS updates | Next.js Cache Components (`"use cache"`, `cacheLife("hours")`) paired with immediate Server Action invalidation (`updateTag(...)`). |
| **Responsiveness** | Mobile-first field usability on 4G and desktop | Tailwind CSS v4 responsive breakpoints (`375px` mobile through `4K` desktop) for rangers at lakeside jetties and tourists on phones. |
| **Security** | Credential protection, input validation, headers | Salted SHA-256 password digests (`lib/auth.ts`), control-character & length sanitization (`lib/sanitize.ts`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict `Referrer-Policy` & `Permissions-Policy` in `next.config.ts`, plus PostgreSQL Row-Level Security (RLS) policies in `supabase/schema.sql`. |
| **Reliability & Graceful Degradation** | Zero crash during offline/demo presentation | Atomic `.data/content.json` write-via-rename store, automatic seed fallback if Supabase tables are unreachable, and cached weather fallback if upstream weather API times out. |
| **Accessibility** | Usable with screen readers & keyboard navigation | Semantic HTML landmarks, ARIA labels/roles on modals & status notices, accessible contrast ratios documented in [accessibility.md](./accessibility.md). |
| **Maintainability** | Modular separation of client UI, server data & validation | Clear separation of client vocabularies (`lib/*-meta.ts`), cached server loaders, typed Server Actions, and atomic UI components. |
