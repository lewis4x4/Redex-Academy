# ADR-0007 — Effort tiering: UltraCode vs standard per goal

**Status:** Accepted

## Context

The build runs through a Claude Code `/goal` workflow, one goal at a time. **UltraCode** is a Claude Code **effort mode** (Opus 4.8) that pins effort to `xhigh` and auto-spins dynamic workflows — parallel subagents plus independent/adversarial verification. It is **not a separate agent**. It produces materially higher-assurance output (especially for security boundaries, the credential/safety path, and the hardest risk bets) but **burns substantially more tokens**. Applying it to every goal would be wasteful (routine CRUD/content/read-side UI doesn't need adversarial verification); applying it to none would under-protect the goals where a defect is a liability, credibility, or contractual-breach event. (ledger §I; CLAUDE.md §9; `AGENT_ROLES_AND_ACCEPTANCE.md` §1.)

## Decision

**Tier each goal's effort, and reserve UltraCode for the heavy/critical goals — always paired with auto mode.**

- **UltraCode** (`xhigh` + dynamic workflow + adversarial verification): **F2, F2a, F3, F4, F5, F5b, F6, M5, M6, M7, M12.** These are the security boundaries (schema/RLS, auth/identity, CCS isolation), the credential/safety path (sign-off veto, OB 3.0 issuance), the sim engines, and the two hardest risk bets (offline sync, the reusable runtime).
- **standard** (normal effort): **F1, S1, M1, M2, M3, M4, M8, M9, M10, M11.** Mechanical scaffolding, content-as-data seeding/rendering, and app-of-an-existing-engine / read-side UI goals.
- **Always pair UltraCode with auto mode**, and be mindful that UltraCode itself burns tokens during the build.

## Consequences

- Token spend is **concentrated where assurance matters** (the safety/credential/security/isolation goals and the hardest bets), keeping the overall build cost-disciplined.
- UltraCode goals carry an **adversarial-verification report that a human reads and accepts before merge** — its output is reviewed, not blindly trusted; if the adversarial pass finds a hole, the goal returns to *build*, not to *merge*.
- Effort tier is **not** a substitute for the human-verification gates (ledger §J): F4 (real-hardware offline), F6/M7 (public-URL badge verify + key custody), M6 (safety-veto behavior), F2/F3/M12 (RLS + tenant isolation) still require human sign-off regardless of tier.
- The per-goal tier is recorded in `goals/GOALS_INDEX.md`, each goal spec, and `AGENT_ROLES_AND_ACCEPTANCE.md` §1; a goal's tier should not be silently downgraded.
