# Business Model & Revenue Plan

**Naujan Lake Eco-Tourism & Wildlife Information Management System (Visitor Hub)**
Requirement A — Business Proposal · Version 1.0 · November 2026

This document covers the four parts of the business proposal — problem, target users, value
proposition and revenue model — and the unit economics behind the numbers. Product scope
lives in [`PRD.md`](./PRD.md); the database that supports these transactions lives in
[`../supabase/schema.sql`](../supabase/schema.sql).

---

## 1. Problem statement

Naujan Lake National Park is the fifth largest lake in the Philippines and a Ramsar Wetland of
International Importance, yet its visitor economy runs on fragmented information:

1. **Rates are unpublished.** Boat and guide tariffs are negotiated at the jetty, which
   undercuts accredited operators who follow the approved schedule.
2. **Bookings are informal.** Requests arrive through Facebook comments and personal
   messages, so the park office has no queue, no reference number and no record of demand.
3. **Guidelines are invisible.** Zoning rules and nesting-season restrictions exist on paper
   but not at the point where a visitor decides to book.
4. **No revenue reaches the protected area.** Tours happen, but the park captures nothing
   from them beyond the environmental fee, so monitoring and maintenance are unfunded.

The portal converts an informal, cash-only, word-of-mouth trade into a documented booking
pipeline that the park office can price, staff and report on.

## 2. Target users and who pays

| Segment | What they need | Do they pay? |
| :--- | :--- | :--- |
| **Visitors** (domestic tourists, students, researchers) | Published tariffs, itineraries, guidelines, a tracked inquiry | Yes — facilitation fee inside the booking |
| **Accredited boat operators & guides** | A steady, documented stream of bookings; no marketing spend | Yes — commission on confirmed bookings |
| **Lakeside businesses** (homestays, carinderias, souvenir stalls) | Visibility in front of arriving visitors | Yes — monthly listing fee |
| **Researchers & academics** | Field-note archive, priority slots on the research trek | Yes — annual membership |
| **Sponsors** (LGUs, telcos, conservation NGOs) | Association with a Ramsar site and a measurable audience | Yes — sponsored advisory slots |
| **Park office (DENR-PENRO / LGU tourism)** | Inquiry queue, demand reports, user management | No — the system is the product they operate |

The paying customer is **not** the park office. The park office is the operator and the
trusted brand; revenue comes from the visitors, operators and businesses that transact
through the portal.

## 3. Value proposition

- **For visitors:** one page that answers *what it costs, what happens, what to bring, and
  whether the boat is running* — plus a reference number they can quote.
- **For operators:** bookings arrive already qualified (date, party size, package), so no
  time is lost on no-shows and price haggling.
- **For the park:** every inquiry becomes a data point — demand per package, seasonal volume,
  guest counts — which is exactly what a protected-area management plan needs to justify
  staffing and fees.
- **For the lake:** guidelines are shown *before* the booking, not after arrival, which is the
  cheapest possible compliance intervention.

## 4. Revenue streams

Six streams, ordered by how much operational effort they add.

| # | Stream | Who pays | Price | Effort |
| :- | :--- | :--- | :--- | :--- |
| 1 | **Booking facilitation fee** | Visitor, per confirmed booking | ₱150 flat | None — collected with the tariff |
| 2 | **Operator commission** | Accredited operator, per confirmed booking | 8% of package tariff | Low — monthly remittance |
| 3 | **Business listing** | Homestays, eateries, souvenir stalls | ₱500 / month | Medium — onboarding + moderation |
| 4 | **Researcher membership** | Academics, students, NGOs | ₱600 / year | Low — gated archive content |
| 5 | **Sponsored advisories** | LGU, telco, conservation NGO | ₱2,500 / month per slot | Medium — sales + disclosure |
| 6 | **Paid education sessions** | Schools booking the research trek | ₱2,000 per session | High — staff time on site |

### 4.1 Why these six

- Streams **1 and 2** are attached to a transaction that already happens; they need no new
  behaviour from the visitor, only a line on the receipt.
- Stream **3** monetises the businesses that already cluster at the jetty and currently rely
  on walk-ins.
- Stream **4** is the only stream aimed at the researcher persona, who is otherwise a
  non-paying user of the wildlife catalogue.
- Stream **5** is capped at two slots so the site never reads as an advertising board.
- Stream **6** exists because the research trek has a 15-person capacity and schools already
  ask for it; the fee covers the guide's day rate.

### 4.2 What is deliberately not monetised

- **No online payment gateway.** Per PRD §9.2, the portal does not process card or e-wallet
  payments; the tariff is settled at the park office and the facilitation fee is remitted
  monthly. This keeps the system compliant with LGU/DENR treasury rules and avoids merchant
  fees on small transactions.
- **No paywall on the wildlife catalogue or the guidelines.** Those pages are the reason
  visitors arrive; charging for them would suppress the funnel that feeds streams 1–2.

## 5. Unit economics

### 5.1 Blended basket

Assumes a mix of 30% birdwatching, 40% sunrise tour, 20% homestay and 10% research trek, at
an average party of three.

| Line | Calculation | Value |
| :--- | :--- | ---: |
| Blended rate per person | 0.30 × ₱1,850 + 0.40 × ₱1,200 + 0.20 × ₱2,400 + 0.10 × ₱1,500 | ₱1,665 |
| Average party size | — | 3 guests |
| **Gross booking value** | 3 × ₱1,665 | **₱4,995** |

### 5.2 What the platform keeps per booking

| Line | Basis | Value |
| :--- | :--- | ---: |
| Facilitation fee | flat | ₱150.00 |
| Operator commission | 8% × ₱4,995 | ₱399.60 |
| **Revenue per booking** | | **₱549.60** |
| Transactional email / SMS | — | −₱4.00 |
| Hosting allocation | ₱18 per booking | −₱18.00 |
| Staff triage | 6 min at ₱250/hour | −₱25.00 |
| Refund / dispute provision | 0.5% of gross | −₱25.00 |
| **Contribution per booking** | | **₱477.60** |

**Contribution margin: 86.9%.** The gross tariff itself (₱4,995) never touches the platform
account — it is settled with the operator and the park office on site. Only the fee and the
commission are platform revenue, which is why the margin is high: the product is a
coordination layer, not a tour operator.

## 6. Year-one projection

Volumes assume 35 bookings/month in the October–March peak and 12/month off-peak.

| Stream | Volume | Unit price | Year 1 |
| :--- | :--- | ---: | ---: |
| Booking facilitation + commission | 282 bookings | ₱549.60 | ₱154,987 |
| Business listings | 8 partners (ramping from month 5) | ₱500 / mo | ₱36,000 |
| Researcher memberships | 60 members | ₱600 / yr | ₱36,000 |
| Sponsored advisories | 10 months, 1 slot | ₱2,500 / mo | ₱25,000 |
| Education sessions | 20 sessions | ₱2,000 | ₱40,000 |
| **Total revenue** | | | **₱291,987** |

| Cost | Basis | Year 1 |
| :--- | :--- | ---: |
| Supabase Pro + hosting | ₱1,500 / month | ₱18,000 |
| Domain and TLS | annual | ₱1,500 |
| Transactional email | ₱400 / month | ₱4,800 |
| Part-time encoder (inquiry triage) | ₱8,000 / month | ₱96,000 |
| Marketing (print + social) | ₱2,000 / month | ₱24,000 |
| Equipment and contingency | — | ₱15,000 |
| **Fixed costs** | | **₱159,300** |
| Variable costs | 282 × ₱72 | ₱20,304 |
| **Total costs** | | **₱179,604** |

**Net year one: ≈ ₱112,400 (38% of revenue).**

### 6.1 Revenue mix

```
Bookings      ████████████████████████████  53%
Education     ███████                       14%
Listings      ██████                        12%
Memberships   ██████                        12%
Sponsorship   ████                           9%
```

Bookings dominate, but the other four streams matter because they are **not seasonal** — they
carry the platform through April–September when tour volume drops by two thirds.

## 7. Break-even

Contribution per booking is ₱477.60; fixed costs are ₱159,300 per year.

| Scenario | Fixed costs to recover from bookings | Break-even bookings | Per month |
| :--- | ---: | ---: | ---: |
| Bookings only (no other streams) | ₱159,300 | 334 | ≈ 28 |
| With listings, memberships, sponsorship and education at run-rate (≈ ₱123,000 contribution) | ₱36,300 | 76 | ≈ 6 |

The second row is the realistic case: **six confirmed bookings a month keeps the platform
above water** once the non-booking streams are live. Everything above that funds monitoring,
guide training and equipment for the protected area.

### 7.1 Sensitivity

| Bookings (year) | Total revenue | Net | Margin |
| ---: | ---: | ---: | ---: |
| 226 (−20%) | ₱261,200 | ₱85,600 | 33% |
| **282 (base)** | **₱292,000** | **₱112,400** | **38%** |
| 338 (+20%) | ₱322,800 | ₱139,100 | 43% |

A 20% swing in bookings moves net margin by about five points, because fixed costs — the
encoder's salary above all — dominate. The first lever is therefore staffing, not pricing.

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Operators bypass the portal and take bookings directly | Commission revenue collapses | The park office only issues boat slots for bookings with a portal reference; facilitation fee is bundled into the published tariff |
| Seasonality (Apr–Sep) | Cash-flow trough | Non-booking streams are deliberately off-season; education sessions are scheduled in the school year |
| Low digital literacy at the jetty | Inquiries never get triaged | The admin queue is usable on a phone; a part-time encoder is budgeted from month one |
| Sponsored content erodes trust | Credibility loss with researchers | Two slots maximum, labelled "Sponsored", never inside advisory text |
| Data privacy complaints | Regulatory exposure | RLS on every table, hashed passwords, no card data stored (see PRD §7.4) |

## 9. How this maps to the course requirements

| Requirement A item | Where it is answered |
| :--- | :--- |
| Problem statement | §1 |
| Target users | §2 |
| Value proposition | §3 |
| Revenue model | §4–§7 |

Supporting evidence elsewhere in the repository:

- **Pricing source of truth:** `lib/tours.ts` (the four published packages and tariffs).
- **Transaction record:** `tour_inquiries` in `supabase/schema.sql`; inquiry statuses in
  `lib/inquiries.ts`; the admin queue at `app/admin/inquiries`.
- **Demand reporting:** the admin dashboard aggregates inquiries by status and by package,
  which is the raw input to the seasonal volume assumptions in §6.
