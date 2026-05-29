# Redex Academy — Goals Index & Dependency Graph

**Authoritative source:** `wave4_decisions_ledger.md`. Where any goal spec conflicts with the ledger, the ledger wins. Each goal file is a machine-feedable spec for Claude Code's `/goal` workflow, one goal at a time.

**How to read a goal file:** Title · Effort tier · Phase · Objective · Depends on · Consumes (contracts) · Tasks · Done-criteria (with `[HUMAN-VERIFY]` flags) · Out of scope · Invariants in play · Tests required.

**Effort (ledger §I — operator directive):** run **EVERY goal with UltraCode + auto mode** (Opus 4.8 xhigh + dynamic parallel subagents + adversarial verification). The standard/ultracode split is retired; the **Tier** column below reads `ultracode` for all 21 goals.

---

## Ordered backlog (build in this order; run independent goals in parallel only when their deps are merged)

| Order | ID | Title | Tier | Phase | Depends on |
|---|---|---|---|---|---|
| 1 | **F1** | Repo + CI/CD + monorepo + env scaffolding | ultracode | 0 | (accounts) |
| 2 | **F2** | Academy schema apply/install + RLS + typegen | ultracode | 0 | F1 |
| 3 | **F2a** | `workos` schema stub + cross-schema FK + grants | ultracode | 0 | F2 |
| 4 | **F3** | Auth + SSO + shared-auth identity + JWT claims | ultracode | 0 | F2 |
| 5 | **F4** | Offline PWA shell + IndexedDB + idempotent `/sync` | ultracode | 0 | F2 |
| 6 | **F5** | Sim framework + engines #1 (branching) & #2 (device-config) + JSON Schemas | ultracode | 0 | F2 |
| 7 | **F5b** | Engines #5 (2D-interaction) & #6 (calculator) + JSON Schemas | ultracode | 0 | F5 |
| 8 | **F6** | OB 3.0 issuer + key mgmt + status list (Deno-vs-Node decision) | ultracode | 0 | F2 |
| 9 | **S1** | MVP-slice catalog seed + AC-203 line-items + badge_class defs | ultracode | Seed | F2, F2a |
| 10 | **M1** | Catalog + prereq-gated enrollment + skill-tree view | ultracode | MVP | F2, S1 |
| 11 | **M2** | MDX lessons + retry-to-mastery knowledge checks (EN+ES) | ultracode | MVP | F2, M1, S1, F5b |
| 12 | **M3** | Branching egress-fail scenario (AC-103, AC-203) | ultracode | MVP | F5, S1, M1 |
| 13 | **M4** | Device-config sim — Aero/Mercury (AC-201) | ultracode | MVP | F5, S1, M1 |
| 14 | **M5** | WebGL install sim — AC-201/203 mag-lock/REX/egress | ultracode | MVP | F5, S1, M1 |
| 15 | **M6** | §5.4 sign-off + line-items + safety-veto + Work OS evidence | ultracode | MVP | F2a, F3, F4, S1 |
| 16 | **M7** | OB 3.0 issuance for the slice (skill→tier stackable) | ultracode | MVP | F6, M6, S1 |
| 17 | **M8** | xAPI → LRS + Postgres summary projection | ultracode | MVP | F4, F5 |
| 18 | **M9** | Authoring admin v1 (content-as-data) | ultracode | MVP | F2, F5, F5b |
| 19 | **M10** | AI adaptive feedback + open-response grading (cached/budgeted) | ultracode | MVP | F5, M3 |
| 20 | **M11** | Manager sign-off dashboard (Realtime) | ultracode | MVP | F3, M6 |
| 21 | **M12** | SSO + one CCS org isolation test | ultracode | MVP | F3, M6 |

**All 21 goals run UltraCode + auto mode** (operator directive; the standard tier is retired).

---

## Dependency graph (ASCII)

```
                                  (accounts + .env, human-owned Phase 0)
                                            │
                                          [F1]  repo/CI/monorepo
                                            │
                                          [F2]  academy schema + RLS + types  ◄── the contract everything compiles against
              ┌──────────────┬─────────────┼───────────────┬──────────────┬───────────────┐
              │              │             │               │              │               │
            [F2a]          [F3]          [F4]            [F5]           [F6]             [S1]*
          workos stub     auth/SSO    offline/sync    sim framework   OB3.0 issuer    slice seed
              │              │             │           engines#1,#2        │          *S1 also needs F2a
              │              │             │               │              │
              │              │             │             [F5b]            │
              │              │             │         engines#5,#6         │
              │              │             │               │              │
   ───────────┴──────────────┴─────────────┴───────────────┴──────────────┴─────────────── Phase 0 / Seed complete
              │                                             │
                          ┌───────────────────────────[M1]  catalog + prereq gating + skill tree (needs F2,S1)
                          │                                  │
                 ┌────────┼──────────┬───────────┬──────────┼──────────┐
                 │        │          │           │          │          │
               [M2]     [M3]       [M4]        [M5]       [M9]        (M1 feeds all MVP UI)
              lessons  branching  deviceCfg   webGL      authoring
            (F5b,S1)  (F5,S1)    (F5,S1)    (F5,S1)†    (F5,F5b)
                                                 │
                                              †M5 ultracode
                 [M6] sign-off + safety-veto + Work OS evidence  (needs F2a,F3,F4,S1)  ── HUMAN-GATE
                   │                          │
                 [M7] OB3.0 issuance         [M11] manager dashboard (Realtime)
                (needs F6,M6,S1) HUMAN-GATE   (needs F3,M6)
                   
                 [M8] xAPI→LRS (needs F4,F5)
                 [M10] AI feedback/grading (needs F5,M3)
                 [M12] SSO + CCS isolation test (needs F3,M6) ── HUMAN-GATE (RLS adversarial)
```

### Critical gating relationships (what blocks what)
- **F2 gates everything.** It produces the generated TS types + RLS + enums every other goal imports. Nothing downstream may invent schema shapes.
- **F5 gates M3/M4/M5/M10** (the engine API, JSON Schema + Zod, shared Verdict/safety-veto hook, xAPI emitter, offline cache contract, colorblind-safe rendering). **F5b gates M2/M9** for the 2D-interaction and calculator engines (AC-101/102/202).
- **F2a gates M6** (the cross-schema FK `academy.signoffs.work_os_job_id → workos.jobs(id)`).
- **S1 gates M1/M2/M3/M4/M5/M6/M7** — without seeded catalog/prereqs/line-items/badge_classes these goals cannot run.
- **F6 gates M7.** **M6 gates M7 and M11.** **F3 gates M6/M11/M12.**

### Human-merge gates (ledger §J — never agent self-certified)
- **F2, F3, M12** — RLS policies + tenant-isolation negative-test matrix reviewed before merge.
- **F4** — offline "never fake a pass" + immutable-after-sign rejection on **real hardware in airplane mode** `[HUMAN-VERIFY]`.
- **F5** — engine API + JSON Schemas signed off before any consumer (M3–M5/M9) builds against them.
- **F6, M7** — credential signing / issuer key custody / proof suite; "badge verifies at a public URL" `[HUMAN-VERIFY]`.
- **M6** — three-layer safety-veto (DB trigger + Edge Fn + UI) + rubric line-item data, adversarially verified.

---

## Phase grouping

- **Phase 0 (Foundation):** F1, F2, F2a, F3, F4, F5, F5b, F6.
- **Seed:** S1.
- **MVP slice (Access Control entry-through-egress):** M1–M12. Slice courses: `FND-101, FND-102, FND-103, INT-101, INT-102, ADC-101, ADC-102, ADC-201, AC-101, AC-102, AC-103, AC-201, AC-202, AC-203` (ledger §D — prereq-closed: `AC-201` needs `ADC-201`; `AC-203` needs `AC-202`; `ADC-201` needs `ADC-101/102`).
- **Phase 2 / 3 (out of scope for this kit):** remaining 5 domains / full 77 courses, full sim library, recert engine, full i18n, RPL, exec dashboards, RAG tutor, INT-301 3D twin.

## Cross-cutting invariants (apply to EVERY goal; see CLAUDE.md)
1. **Safety-veto** — a single `0` on any `is_critical_safety` line ⇒ automatic `fail`, non-overridable; enforced in DB trigger + Edge Fn + UI. Never simplified.
2. **Credential state is server-only** — competency promotion, mastery verdict, sign-off finalize, badge issuance/revocation, recert scheduling run only in service-role Edge Functions. The client never writes state tables.
3. **RLS deny-by-default + tenant isolation** on `org_id = (auth.jwt() ->> 'org_id')::uuid`.
4. **Offline never fakes a pass** — append-only events keyed on `client_event_uuid`; `/sync` idempotent; finalized sign-offs immutable; LWW only for drafts/prefs.
5. **Contract-first** — if a contract (schema/types/JSON Schema/engine API) is missing, STOP and surface it; do not invent it.
6. **One identity space** — `academy.users.id = auth.users.id`; no `work_os_user_id` column; cross-schema joins on `auth.users.id`.
7. **Colorblind-safe** — never encode pass/fail by color alone (shape + text + color); WCAG 2.1 AA.
8. **Migration→typegen** — every schema change = new migration + regenerate types + commit both; never hand-edit generated types.
