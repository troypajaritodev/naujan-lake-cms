# System Design Document
## Naujan Lake Eco-Tourism & Wildlife Information Management System

- **Course:** Web Systems and Technologies 2 · System Integration and Architecture 1
- **Version:** 1.0 · November 2026
- **Related Documents:** [SRS](./SRS.md) · [Business Model & Revenue Plan](./REVENUE_MODEL.md) · [Product Requirements Document](./PRD.md) · [Database Schema](../supabase/schema.sql)

---

## 1. Use Case Diagram

The park platform serves three actor scopes across public discovery, tourist booking/tracking, and park staff content/operations management.

- **Diagram Figure:** [docs/figures/use_case_diagram.svg](./figures/use_case_diagram.svg)

```mermaid
flowchart LR
  Visitor(["Visitor / Eco-Tourist"])
  Admin(["Park Admin / Ranger"])
  Mail(["Resend / Weather API"])

  subgraph Portal["Naujan Lake Visitor Hub & CMS"]
    UC1["Browse Wildlife, Tours & Rules"]
    UC2["Register / Login / Edit Profile"]
    UC3["Book Tour + Submit First Payment"]
    UC4["Track Status, Message Staff & View QR Pass"]
    UC5["Manage Advisories, Tours, Species & Rules (CMS)"]
    UC6["Verify Deposits, Update Status & Verify QR Passes"]
    UC7["Manage Users, Subscribers & Export CSV Reports"]
  end

  Visitor --> UC1
  Visitor --> UC2
  Visitor --> UC3
  Visitor --> UC4
  Admin --> UC2
  Admin --> UC5
  Admin --> UC6
  Admin --> UC7
  UC3 -. triggers .-> Mail
  UC6 -. triggers .-> Mail
```

---

## 2. Context Diagram (Level-0 DFD)

The Context Diagram defines the boundary between the Naujan Lake system and its external actors/integrations.

- **Diagram Figure:** [docs/figures/context_diagram.svg](./figures/context_diagram.svg)

```mermaid
flowchart TB
  Visitor["Visitor / Eco-Tourist"]
  Admin["Park Admin / Ranger"]
  Operators["Accredited Boat Operators"]
  APIs["External APIs (Supabase, Resend, Open-Meteo, OpenStreetMap)"]

  System(("0. Naujan Lake Eco-Tourism\n& Wildlife CMS"))

  Visitor -- "Signups, Bookings, Deposits, Messages" --> System
  System -- "Tariffs, Advisories, Tracker, QR Entry Pass" --> Visitor

  Admin -- "CMS Updates, Status Decisions, Replies" --> System
  System -- "Booking Queue, Payment Proofs, CSV Reports" --> Admin

  System -- "Confirmed Passenger Manifests" --> Operators
  Operators -- "Capacity & Jetty Dispatch Updates" --> System

  System -- "Queries, Mail Payloads, Weather/Map Requests" --> APIs
  APIs -- "Rows, Delivery Status, Live Weather, Map Tiles" --> System
```

---

## 3. System Architecture Diagram

The application uses a four-tier **Next.js 16 App Router** architecture combining React 19 UI, Next.js Cache Components (`"use cache"` + `updateTag()`), atomic JSON + Supabase PostgreSQL persistence, and external API adapters.

- **Diagram Figure:** [docs/figures/architecture_diagram.svg](./figures/architecture_diagram.svg)

```mermaid
flowchart TB
  subgraph Tier1["1. Presentation Layer (Next.js App Router + Tailwind CSS v4)"]
    P1["Public Portal (/wildlife, /tours, /advisories, /guidelines, /subscribe)"]
    P2["Visitor Portal (/inquire, /account Tracker + Messenger, /verify QR)"]
    P3["Admin CMS (/admin/users, /inquiries, /subscribers, /advisories, /tours, /species, /rules)"]
  end

  subgraph Tier2["2. Application & Integration Layer"]
    S1["Cached Read Loaders ('use cache' + cacheTag)"]
    S2["Server Actions (Zod-style validation + updateTag)"]
    S3["Route Handlers (/api/inquiries/notify, /status, /weather)"]
    S4["Security, QR Encoder (qrcode) & CSV Export"]
  end

  subgraph Tier3["3. Data & Persistence Layer"]
    D1["Supabase PostgreSQL (7 Relational Tables + RLS)"]
    D2[".data/content.json Atomic CMS Override Store"]
    D3["localStorage Demo Stores (nl.users.v1, nl.inquiries.v1)"]
  end

  subgraph Tier4["4. External Services"]
    E1["Resend Email API"]
    E2["Open-Meteo Weather API"]
    E3["OpenStreetMap Embed"]
  end

  Tier1 --> Tier2
  S1 --> D1
  S1 --> D2
  S2 --> D2
  S4 --> D3
  S3 --> E1
  S3 --> E2
  P1 --> E3
```

---

## 4. Database Schema & Entity-Relationship Diagram (ERD)

The relational PostgreSQL schema in [supabase/schema.sql](../supabase/schema.sql) defines **7 normalized tables** (exceeding the minimum 5-table requirement) with enums, foreign keys, `updated_at` triggers, and Row-Level Security (RLS) policies:

1. **`users`** — Registered visitors and park administrators (`id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `is_active`).
2. **`categories`** — 5 wildlife taxonomy categories (`id`, `slug`, `name`, `description`, `sort_order`).
3. **`species`** — Documented Naujan Lake wildlife (`id`, `category_id` FK -> `categories`, `slug`, `common_name`, `local_name`, `scientific_name`, `conservation_status`, `seasonality`, `habitat`, `description`, `featured_image`).
4. **`tours`** — Eco-tourism boat packages (`id`, `slug`, `title`, `tagline`, `description`, `duration`, `rate_per_person`, `max_capacity`, `departure_window`, `highlights`, `inclusions`, `is_available`).
5. **`advisories`** — Park safety & wildlife notices (`id`, `slug`, `title`, `severity`, `category`, `excerpt`, `content`, `actions`, `is_active_banner`, `published_at`, `effective_until`).
6. **`tour_inquiries`** — Visitor booking transactions (`id`, `reference_code`, `tour_id` FK -> `tours`, `user_id` FK -> `users`, `visitor_name`, `visitor_email`, `visitor_phone`, `preferred_date`, `party_size`, `first_payment_amount`, `payment_method`, `payment_status`, `status`, `notes`).
7. **`subscribers`** — Mailing list subscriptions (`id`, `email`, `full_name`, `tier`, `status`).

- **Diagram Figure:** [docs/figures/er_diagram.svg](./figures/er_diagram.svg)

```mermaid
erDiagram
  users ||--o{ tour_inquiries : "submits"
  tours ||--o{ tour_inquiries : "booked in"
  categories ||--o{ species : "classifies"
  users {
    uuid id PK
    text email UK
    text full_name
    user_role role
    boolean is_active
  }
  categories {
    uuid id PK
    text slug UK
    text name
    int sort_order
  }
  species {
    uuid id PK
    uuid category_id FK
    text slug UK
    text common_name
    conservation_status conservation_status
  }
  tours {
    uuid id PK
    text slug UK
    text title
    numeric rate_per_person
    int max_capacity
  }
  tour_inquiries {
    uuid id PK
    uuid tour_id FK
    uuid user_id FK
    text reference_code UK
    date preferred_date
    inquiry_status status
  }
  advisories {
    uuid id PK
    text slug UK
    advisory_severity severity
    boolean is_active_banner
  }
  subscribers {
    uuid id PK
    text email UK
    subscriber_tier tier
    subscriber_status status
  }
```

---

## 5. UI Wireframes

The visual wireframe blueprints covering the Home Portal, Booking & First Payment Form, Visitor Account Tracker / Messenger / QR Pass, and Admin CMS Console are saved in:

- **Wireframes Sheet:** [docs/figures/wireframes.svg](./figures/wireframes.svg)
