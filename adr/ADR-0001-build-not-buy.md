# ADR-0001 — Build a custom application; do not buy an LMS

**Status:** Accepted

## Context

Redex Academy must deliver the curriculum's **"See one / Do one / Prove one"** loop: a tech learns, rehearses in a realistic simulation, then earns an **Evaluator-signed field sign-off with evidence** that mints a portable **Open Badges 3.0** credential and is kept current across ~1,600 sites. The curriculum explicitly **bans "slides-and-quiz"** and seat-time content delivery. The candidate alternative is buying a generic LMS (Docebo, TalentLMS, Cornerstone) as the system of record. Commercial LMSs are structurally weak in the four dimensions that constitute ~80% of this product's value: simulation-first interactivity (they are SCORM/xAPI *players*, not bespoke runtime authoring environments); offline-first field delivery in retail dead zones (their "mobile apps" are thin online clients); deep Work OS + Alarm.com/OpenEye integration for realistic sims and field evidence (a SaaS LMS sits outside our VPC and RLS); and owned OB 3.0 issuance with verifiable evidence URLs, expiry, and platform-change recert (most LMS "badges" are decorative or a closed silo). Add data ownership, row-level CCS subcontractor isolation, and per-seat cost at scale. (wave3 §1.)

## Decision

**Build a custom application on the existing Redex stack** — Supabase (Postgres/RLS/Auth/Edge/Realtime/Storage) + React/TS + Cloudflare — whose core domain objects are *competencies, simulation telemetry, field evidence, and credentials*, with "courses" as one content type layered on top. **Buy only narrow, boring commodity components** that carry no strategic weight: Cloudflare Stream (video), a self-hosted xAPI LRS, an OB 3.0 / W3C VC signing library, and LLM/voice APIs. The rule: **buy where it's a commodity and carries no moat; build where the curriculum's differentiators live.**

## Consequences

- We own the hard 80% (sim runtime, offline sync, credential issuer, LRS) — and the operational burden that comes with it: uptime, security patching, key custody.
- We accept slower time-to-first-content (months to MVP vs. an afternoon to host a video on a SaaS LMS) and rebuild commodity LMS plumbing (enrollment, admin CRUD, completion reporting) — mitigated by Supabase accelerating CRUD/admin.
- The build's **marginal cost per additional learner is near-zero** (storage + a little compute), versus a per-seat license that grows with every CCS subcontractor onboarded — so build is cheaper in steady state at this scale and growth pattern.
- This decision is driven **by this curriculum**, not as a default engineering preference: if Redex wanted a generic corporate training portal, buying would win.
