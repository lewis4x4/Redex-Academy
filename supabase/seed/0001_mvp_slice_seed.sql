-- ============================================================================
-- 0001_mvp_slice_seed.sql
-- Redex Academy — MVP-SLICE CATALOG SEED (goal S1).
--
-- Seeds the 14-course Access-Control-through-egress MVP slice (ledger §D) into
-- the `academy` schema created by `0001_init_academy.sql`. This is the data
-- CONTRACT that M1 (skill-tree), M2 (assessments), M6 (finalize-signoff) and
-- M7 (issue-badge) build against (invariant 5 — contract-first; the M-goals
-- consume this shape, they do NOT invent catalog/badge shapes).
--
-- Source of truth for the content: `course_bible_master.md` (titles, tiers,
-- personas, objectives, §5.4 line items) reconciled with `wave4_decisions_
-- ledger.md` §B/§C/§D and goal `S1.md` (the corrected prereq closure + the
-- exact AC-203 critical-safety line-item keys + badge stackability).
--
-- DESIGN RULES (do not weaken):
--   * EVERYTHING is schema-qualified (academy.…) — never rely on search_path.
--   * IDEMPOTENT + FORWARD-ONLY: every INSERT uses ON CONFLICT … DO NOTHING on a
--     stable natural/business key, so re-running yields identical row counts and
--     never errors (S1 done-criterion: "running the seed twice yields identical
--     row counts"). Re-runnable in any order against a fresh or seeded stack.
--   * STABLE UUIDs: deterministic literal UUIDs from a documented namespacing
--     scheme (see "UUID SCHEME" below). NO gen_random_uuid() for seeded rows, so
--     re-runs, FKs, and downstream test fixtures are stable across environments.
--   * The seeded course_prerequisites graph MUST remain a DAG — verified at the
--     end via academy.prereq_graph_is_dag() (raises if a cycle slipped in).
--
-- UUID SCHEME (deterministic, human-greppable; all v4-shaped, fixed bytes):
--   orgs ............. 00000a60-0000-0000-0000-0000000000NN   ('a60' = org namespace)
--   competencies ..... 000000c0-0000-0000-0000-0000000000NN
--   courses .......... 000000c1-0000-0000-0000-0000000000NN  (NN = course slot)
--   course_versions .. 000000c2-0000-0000-0000-0000000000NN  (NN mirrors course)
--   units ............ 000000c3-CCCC-0000-0000-0000000000UU  (CCCC=course, UU=ordinal)
--   assessment_items . 000000a5-CCCC-0000-0000-0000000000II  (CCCC=course, II=item)
--   badge_classes .... 000000b9-0000-0000-0000-0000000000NN
--   signoff_line_item_templates 000000b1-CCCC-0000-0000-0000000000LL  (CCCC=course, LL=line)
--   The slice has no seeded users/signoffs (those are created at runtime by the
--   app / M6). The §5.4 sign-off rubric line-item TEMPLATES are seeded as
--   first-class rows in academy.signoff_line_item_templates (section 7b — the
--   CANONICAL source, added by migrations/0003_signoff_line_item_templates.sql);
--   each signoff_prep unit content_ref carries only a short pointer at that table.
--
-- Run:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f seed/0001_mvp_slice_seed.sql
--       (requires 0001_init_academy.sql + 0002_workos_stub.sql + 0003_signoff_
--        line_item_templates.sql applied first).
-- ============================================================================

begin;

-- Seed rows are reference/catalog data written by the build (the service role /
-- migration owner). RLS is FORCEd on these tables; run this file as the DB
-- owner / migration superuser (the same role that ran 0001), NOT as a tenant
-- JWT. (catalog SELECT is later public via the published-status policies.)

-- ----------------------------------------------------------------------------
-- 1. ORGS — the Redex tenant + one CCS partner (for the M12 isolation test)
-- ----------------------------------------------------------------------------
-- ledger §A: academy.orgs is THE canonical tenant table. The CCS partner nests
-- under Redex (parent_org_id) for shared-catalog visibility while its PII stays
-- isolated (the M12 cross-tenant isolation test seeds against this partner).
insert into academy.orgs (id, name, type, parent_org_id, locale_default) values
  ('00000a60-0000-0000-0000-000000000001', 'Redex',               'redex',       null, 'en')
on conflict (id) do nothing;

insert into academy.orgs (id, name, type, parent_org_id, locale_default) values
  ('00000a60-0000-0000-0000-000000000002', 'CCS Partner (demo)',  'ccs_partner',
     '00000a60-0000-0000-0000-000000000001', 'en')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. COMPETENCIES — the atomic "can do X" the slice grades against (ledger §C)
-- ----------------------------------------------------------------------------
-- is_safety_critical = true on egress / life-safety / fail-state competencies
-- (drives badge + recert logic; AC-103 awareness egress, AC-203 egress wiring,
-- the fail-safe/fail-locked judgment, and FND-102 field safety).
-- mastery_threshold: 0.90 for safety-critical (the ≥90% gate per ledger §C / the
-- Course Bible assessment standard), 0.80 otherwise (the coarse scalar fallback;
-- item-level is_safety_item is authoritative at runtime).
-- Codes follow the schema convention DOMAIN.THING (e.g. EGRESS.MAGLOCK_FAILSAFE,
-- matching the schema comment + the committed invariants test fixture).
insert into academy.competencies (id, code, title, domain, description, is_safety_critical, mastery_threshold) values
  -- Foundations
  ('000000c0-0000-0000-0000-000000000001', 'FND.COMPANY_MODEL',        'Redex company & Work OS model literacy',        'FND',
     'States what Redex is, the five Work OS pillars, and why install quality compounds across the anchor account.', false, 0.80),
  ('000000c0-0000-0000-0000-000000000002', 'FND.FIELD_SAFETY',         'Field safety: ladders, LOTO, PPE, egress',      'FND',
     'OSHA ladder setup, low- vs line-voltage safety, LOTO, PPE, never blocking egress, stop-work authority (FND-102 hard safety gate).', true, 0.90),
  ('000000c0-0000-0000-0000-000000000003', 'FND.LOWVOLTAGE_CABLING',   'Low-voltage & structured cabling literacy',     'FND',
     'Cable families, 100m channel rule, T568A/B, bend radius, power separation, PoE classes, plenum/riser fire-rating.', false, 0.80),
  -- Integration / Work OS
  ('000000c0-0000-0000-0000-000000000004', 'INT.WORKOS_ESSENTIALS',    'Work OS essentials & the closeout quartet',     'INT',
     'Traces a job through the five pillars; the closeout quartet (checklist, photos, signature, activation call-in).', false, 0.80),
  ('000000c0-0000-0000-0000-000000000005', 'INT.WORKOS_FIELD_OFFLINE', 'Work OS field execution, offline-first sync',   'INT',
     'Completes the mobile field-execution flow fully offline and confirms a clean, non-duplicating sync on reconnect.', false, 0.80),
  -- Alarm.com
  ('000000c0-0000-0000-0000-000000000006', 'ADC.ECOSYSTEM_MODEL',      'Alarm.com platform & dealer/partner model',     'ADC',
     'What Alarm.com is, the dealer/partner model, the three surfaces, which Redex hardware is/ is not Alarm.com.', false, 0.80),
  ('000000c0-0000-0000-0000-000000000007', 'ADC.PORTAL_NAV',           'Partner Portal navigation & login hygiene',     'ADC',
     'Logs in with 2FA, navigates the IA, finds a customer account, dealer login least-privilege hygiene.', false, 0.80),
  ('000000c0-0000-0000-0000-000000000008', 'ADC.ACCOUNT_SETUP',        'Partner Portal account, device & customer setup','ADC',
     'Creates a customer end-to-end, logins vs user codes, permission levels, adds an access-control device, escalates the last-name bug.', false, 0.80),
  -- Access Control
  ('000000c0-0000-0000-0000-000000000009', 'AC.DOOR_ANATOMY',          'Access-controlled door anatomy & event sequence','AC',
     'Names the five door components + DPS + power supply; traces the access-event sequence; entry vs egress side.', false, 0.80),
  ('000000c0-0000-0000-0000-00000000000a', 'AC.CRED_LOCK_SELECTION',   'Credential, reader-protocol & lock-family selection','AC',
     'Compares credential techs, Wiegand vs OSDP, the three lock families, and selects the correct fail-state for a door role.', false, 0.80),
  ('000000c0-0000-0000-0000-00000000000b', 'AC.FAILSTATE_JUDGMENT',    'Fail-safe vs fail-locked judgment',             'AC',
     'Correctly applies fail-safe (unlocks on power loss) vs fail-locked/fail-secure to a door''s egress role — safety-adjacent.', true, 0.90),
  ('000000c0-0000-0000-0000-00000000000c', 'EGRESS.NFPA101_AWARENESS', 'Egress, life-safety & NFPA 101 awareness',      'AC',
     'Free egress, means of egress, §7.2.1.6 special locking, the headline numbers, the AHJ, stop-and-escalate (AC-103, ≥90%).', true, 0.90),
  ('000000c0-0000-0000-0000-00000000000d', 'AC.AERO_SINGLE_DOOR',      'ADC-AC Aero single-door commissioning',         'AC',
     'Mounts/powers/terminates one Aero X1100 door (reader, lock, REX, DPS), commissions to Alarm.com, verifies live.', true, 0.90),
  ('000000c0-0000-0000-0000-00000000000e', 'AC.MERCURY_WIRING',        'Mercury LP1501/LP1502 panel wiring',            'AC',
     'Selects LP1501 vs LP1502, powers correctly (PoE vs 12-24VDC), terminates readers/lock/REX/DPS with supervision, gauge/voltage-drop.', true, 0.90),
  ('000000c0-0000-0000-0000-00000000000f', 'EGRESS.MAGLOCK_FAILSAFE',  'Mag lock + REX + egress wiring (fail-safe)',    'AC',
     'Wires a mag lock fail-safe; REX + push-to-exit per §7.2.1.6.2; fire-alarm release interface; proves all three release modes (AC-203 hard gate).', true, 0.90)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 3. COURSES + COURSE_VERSIONS (v1.0.0, published) + UNITS
-- ----------------------------------------------------------------------------
-- One published course_version (semver 1.0.0) per course; courses.status =
-- 'published' and active_version_id wired to it. personas as the academy.persona[]
-- enum (nova|marco|priya|dana) mapped from the bible's A/B/C/D key:
--   A=nova, B=marco, C=priya, D=dana.
-- platform_manifest carries the exact HW/firmware/portal surfaces the version
-- teaches (the recert engine targets on it, §8) — populated where relevant
-- (AC-201 Aero X1100; AC-202 Mercury LP1501/LP1502; the ADC portal courses).
--
-- We insert courses first (without active_version_id), then versions, then patch
-- active_version_id, so the FK (courses.active_version_id -> course_versions.id)
-- is satisfiable and idempotent.

-- 3a. COURSES (status=published so the catalog RLS exposes them; tier/domain/personas)
insert into academy.courses (id, code, title, domain, tier, personas, status) values
  ('000000c1-0000-0000-0000-000000000001', 'FND-101', 'Welcome to Redex & the Victra Mission',                'FND', 'foundations', '{nova,marco,priya,dana}', 'published'),
  ('000000c1-0000-0000-0000-000000000002', 'FND-102', 'Safety, Ladders, Rooftops & Low-Voltage Basics (SAFETY GATE)', 'FND', 'foundations', '{nova,marco,priya}',      'published'),
  ('000000c1-0000-0000-0000-000000000003', 'FND-103', 'Electricity & Low-Voltage / Cabling Literacy 101',     'FND', 'foundations', '{nova,marco,priya}',      'published'),
  ('000000c1-0000-0000-0000-000000000004', 'INT-101', 'Redex Work OS Essentials',                             'INT', 'foundations', '{nova,marco,priya,dana}', 'published'),
  ('000000c1-0000-0000-0000-000000000005', 'INT-102', 'Work OS for the Field: Jobs, Evidence & Sync (offline-first)', 'INT', 'foundations', '{nova,marco}',            'published'),
  ('000000c1-0000-0000-0000-000000000006', 'ADC-101', 'Intro to Alarm.com & the Dealer/Partner Model',        'ADC', 'foundations', '{nova,marco,priya,dana}', 'published'),
  ('000000c1-0000-0000-0000-000000000007', 'ADC-102', 'Navigating the Partner Portal (Ecosystem: What Connects to What)', 'ADC', 'foundations', '{nova,priya,dana}',       'published'),
  ('000000c1-0000-0000-0000-000000000008', 'ADC-201', 'Partner Portal: Accounts, Devices & Customer Setup',   'ADC', 'core',        '{marco,priya}',           'published'),
  ('000000c1-0000-0000-0000-000000000009', 'AC-101',  'Intro to Access Control',                              'AC',  'foundations', '{nova,marco,priya,dana}', 'published'),
  ('000000c1-0000-0000-0000-00000000000a', 'AC-102',  'Credentials, Readers & Door Hardware Concepts',        'AC',  'foundations', '{nova,marco,priya,dana}', 'published'),
  ('000000c1-0000-0000-0000-00000000000b', 'AC-103',  'Egress, Life-Safety & NFPA 101 Awareness',             'AC',  'foundations', '{nova,marco,priya,dana}', 'published'),
  ('000000c1-0000-0000-0000-00000000000c', 'AC-201',  'Single-Door Install: ADC-AC Aero',                     'AC',  'core',        '{marco,priya}',           'published'),
  ('000000c1-0000-0000-0000-00000000000d', 'AC-202',  'Wiring Mercury LP1501/LP1502 Panels',                  'AC',  'core',        '{marco,priya}',           'published'),
  ('000000c1-0000-0000-0000-00000000000e', 'AC-203',  'Mag Locks, REX & Basic Egress Wiring (EGRESS HARD GATE)', 'AC', 'core',     '{marco,priya}',           'published')
on conflict (code) do nothing;

-- 3b. COURSE_VERSIONS — one published v1.0.0 each; platform_manifest where relevant.
insert into academy.course_versions (id, course_id, semver, status, published_at, changelog, platform_manifest) values
  ('000000c2-0000-0000-0000-000000000001', '000000c1-0000-0000-0000-000000000001', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{}'::jsonb),
  ('000000c2-0000-0000-0000-000000000002', '000000c1-0000-0000-0000-000000000002', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"standards":["OSHA 1910.23","OSHA 1926.1053","NFPA 70E"]}'::jsonb),
  ('000000c2-0000-0000-0000-000000000003', '000000c1-0000-0000-0000-000000000003', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"standards":["TIA-568","IEEE 802.3af/at/bt"]}'::jsonb),
  ('000000c2-0000-0000-0000-000000000004', '000000c1-0000-0000-0000-000000000004', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"platforms":["work_os"]}'::jsonb),
  ('000000c2-0000-0000-0000-000000000005', '000000c1-0000-0000-0000-000000000005', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"platforms":["work_os_mobile"]}'::jsonb),
  ('000000c2-0000-0000-0000-000000000006', '000000c1-0000-0000-0000-000000000006', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"platforms":["alarm_com"]}'::jsonb),
  ('000000c2-0000-0000-0000-000000000007', '000000c1-0000-0000-0000-000000000007', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"platforms":["adc_partner_portal"]}'::jsonb),
  ('000000c2-0000-0000-0000-000000000008', '000000c1-0000-0000-0000-000000000008', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"platforms":["adc_partner_portal"]}'::jsonb),
  ('000000c2-0000-0000-0000-000000000009', '000000c1-0000-0000-0000-000000000009', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"vendors":["securitron","mercury","adc_aero"]}'::jsonb),
  ('000000c2-0000-0000-0000-00000000000a', '000000c1-0000-0000-0000-00000000000a', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"protocols":["wiegand","osdp"]}'::jsonb),
  ('000000c2-0000-0000-0000-00000000000b', '000000c1-0000-0000-0000-00000000000b', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"standards":["NFPA 101 §7.2.1.6"]}'::jsonb),
  ('000000c2-0000-0000-0000-00000000000c', '000000c1-0000-0000-0000-00000000000c', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"platforms":["adc_partner_portal"],"hardware":["ADC-AC-X1100-2PSE Aero"]}'::jsonb),
  ('000000c2-0000-0000-0000-00000000000d', '000000c1-0000-0000-0000-00000000000d', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"hardware":["Mercury LP1501","Mercury LP1502"],"protocols":["wiegand","osdp"]}'::jsonb),
  ('000000c2-0000-0000-0000-00000000000e', '000000c1-0000-0000-0000-00000000000e', '1.0.0', 'published', now(), 'MVP slice seed (S1).', '{"hardware":["M62/V2M1200 1200s maglock"],"standards":["NFPA 101 §7.2.1.6.2"],"interfaces":["facp_relay"]}'::jsonb)
on conflict (course_id, semver) do nothing;

-- 3c. Patch courses.active_version_id -> the published v1.0.0 (idempotent: only
--     sets when currently null, so a re-run is a no-op).
update academy.courses c
  set active_version_id = v.id
  from academy.course_versions v
  where v.course_id = c.id
    and v.semver = '1.0.0'
    and c.active_version_id is null;

-- 3d. UNITS — the course's key chunks, mapped to the engine kinds from S1 §3 /
--     the Course Bible interactive elements. unit.kind uses the academy.unit_kind
--     enum (lesson|sim|scenario|knowledge_check|video|checklist|signoff_prep).
--     content_ref is a DOCUMENTED placeholder pointer (R2/MDX keys + an "engine"
--     hint so M2-M5 know which sim engine a 'sim' unit needs); real MDX/specs are
--     authored in M2-M5 (out of S1 scope). competency_id maps the unit's primary
--     competency; section 4 adds the many-to-many unit_competencies rows.
--     The signoff_prep units on AC-201/202/203 carry only a short POINTER at the
--     §5.4 rubric-template table; the line items themselves are first-class rows in
--     academy.signoff_line_item_templates (section 7b — the canonical source, added
--     by migrations/0003; the former [SCHEMA GAP] is RESOLVED).
--     unique (course_version_id, ordinal) backs the ON CONFLICT idempotency.

-- FND-101 (cv …001)
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0001-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000001', 1, 'Who Redex Is & the Five Work OS Pillars', 'lesson',          '000000c0-0000-0000-0000-000000000001', 25, '{"mdx_key":"fnd-101/u1","placeholder":true}'::jsonb),
  ('000000c3-0001-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000001', 2, 'Build the Wheel (Service Ecosystem)',     'sim',             '000000c0-0000-0000-0000-000000000001', 20, '{"engine":"interaction_2d","spec_key":"fnd-101/build-the-wheel","placeholder":true}'::jsonb),
  ('000000c3-0001-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000001', 3, 'Foundations Knowledge Check',             'knowledge_check', '000000c0-0000-0000-0000-000000000001', 15, '{"item_set":"fnd-101","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- M3: the AC-203 branching egress-fail sim definition — the authoritative spec the
-- finalize-sim-attempt Edge Function reads to RE-SCORE server-side (invariant 3). S1
-- deliberately omitted sim_definitions (SEED_NOTES §4); M3 ships AC-203's. kind=
-- branching_scenario; competency = EGRESS.MAGLOCK_FAILSAFE; key matches the unit
-- content_ref spec_key 'ac-203/egress-compliant'. id is referenced client-side as
-- AC203_SIM_DEFINITION_ID (apps/web/src/forge/ac203Recording.ts).
insert into academy.sim_definitions (id, key, version, kind, spec, competency_ids, status, source_citation) values
  ('000000d1-0000-0000-0000-00000000000e', 'ac-203/egress-compliant', '1.1.0', 'branching_scenario',
   $sim${"$schema": "https://academy.goredex.com/sim-contracts/schemas/branching.schema.json", "envelope": {"spec_version": "1.1.0", "sim_id": "ac203.egress-fail.maglock-door", "engine_kind": "branching_scenario", "title_i18n": "sim.ac203.egress-fail.title", "competency_ids": ["000000c0-0000-0000-0000-00000000000f"], "locales": ["en", "es"], "scoring": {"pass_threshold": 0.8, "safety_pass_threshold": 0.9, "veto_on_any_safety_failure": true, "veto_feedback_i18n": "sim.ac203.egress-fail.veto", "veto_state": {"token": "safety_veto", "shape": "octagon", "label_i18n": "sim.common.state.safety_stop", "color_role": "danger"}}, "emits_verbs": ["http://adlnet.gov/expapi/verbs/attempted", "http://adlnet.gov/expapi/verbs/answered", "http://adlnet.gov/expapi/verbs/completed", "https://academy.goredex.com/xapi/verbs/triggered-safety-veto"], "state_tokens": [{"token": "pass", "shape": "check", "label_i18n": "sim.common.state.pass", "color_role": "success"}, {"token": "fail", "shape": "cross", "label_i18n": "sim.common.state.fail", "color_role": "danger"}, {"token": "safety_veto", "shape": "octagon", "label_i18n": "sim.common.state.safety_stop", "color_role": "danger"}], "i18n_string_keys": ["sim.ac203.egress-fail.title", "sim.ac203.egress-fail.veto", "sim.ac203.egress-fail.node.failstate.prompt", "sim.ac203.egress-fail.choice.failsafe.label", "sim.ac203.egress-fail.choice.failsafe.consequence", "sim.ac203.egress-fail.choice.faillocked.label", "sim.ac203.egress-fail.choice.faillocked.consequence", "sim.ac203.egress-fail.node.rex.prompt", "sim.ac203.egress-fail.choice.pushtoexit.label", "sim.ac203.egress-fail.choice.pushtoexit.consequence", "sim.ac203.egress-fail.choice.motiononly.label", "sim.ac203.egress-fail.choice.motiononly.consequence", "sim.ac203.egress-fail.node.placement.prompt", "sim.ac203.egress-fail.choice.mount_reachable.label", "sim.ac203.egress-fail.choice.mount_reachable.consequence", "sim.ac203.egress-fail.choice.mount_high.label", "sim.ac203.egress-fail.choice.mount_high.consequence", "sim.ac203.egress-fail.node.firealarm.prompt", "sim.ac203.egress-fail.choice.facp.label", "sim.ac203.egress-fail.choice.facp.consequence", "sim.ac203.egress-fail.choice.nofacp.label", "sim.ac203.egress-fail.choice.nofacp.consequence", "sim.ac203.egress-fail.node.closeout.prompt", "sim.ac203.egress-fail.choice.document.label", "sim.ac203.egress-fail.choice.document.consequence", "sim.ac203.egress-fail.choice.packup.label", "sim.ac203.egress-fail.choice.packup.consequence", "sim.ac203.egress-fail.terminal.pass.text", "sim.ac203.egress-fail.terminal.trapped_lock.text", "sim.ac203.egress-fail.terminal.trapped_motion.text", "sim.ac203.egress-fail.terminal.trapped_placement.text", "sim.ac203.egress-fail.terminal.trapped_fire.text", "sim.ac203.egress-fail.terminal.fail_docs.text", "sim.ac203.egress-fail.replay.faillocked.overlay", "sim.ac203.egress-fail.replay.motiononly.overlay", "sim.ac203.egress-fail.replay.mount_high.overlay", "sim.ac203.egress-fail.replay.nofacp.overlay", "sim.common.state.pass", "sim.common.state.fail", "sim.common.state.safety_stop", "sim.ac203.media.storefront.alt", "sim.ac203.media.crowd_trapped.alt"], "fixture_set_ref": null, "offline_cacheable": true}, "start": "failstate", "nodes": {"failstate": {"type": "situation", "prompt_i18n": "sim.ac203.egress-fail.node.failstate.prompt", "is_safety_decision": true, "media": [{"r2_key": "sims/ac203/storefront-maglock-door.jpg", "kind": "image", "alt_i18n": "sim.ac203.media.storefront.alt"}], "choices": [{"id": "failsafe", "label_i18n": "sim.ac203.egress-fail.choice.failsafe.label", "to": "rex", "consequence_i18n": "sim.ac203.egress-fail.choice.failsafe.consequence", "score_delta": 3, "safety_flag": false, "is_safety_decision": true, "verdict": {"dimension": "safety_compliance", "line_item_key": "ac203.release_on_power_loss"}}, {"id": "faillocked", "label_i18n": "sim.ac203.egress-fail.choice.faillocked.label", "to": "trapped_lock", "consequence_i18n": "sim.ac203.egress-fail.choice.faillocked.consequence", "score_delta": -3, "safety_flag": true, "is_safety_decision": true, "verdict": {"dimension": "safety_compliance", "line_item_key": "ac203.release_on_power_loss"}}]}, "rex": {"type": "prompt", "prompt_i18n": "sim.ac203.egress-fail.node.rex.prompt", "is_safety_decision": true, "choices": [{"id": "pushtoexit", "label_i18n": "sim.ac203.egress-fail.choice.pushtoexit.label", "to": "placement", "consequence_i18n": "sim.ac203.egress-fail.choice.pushtoexit.consequence", "score_delta": 3, "safety_flag": false, "is_safety_decision": true, "verdict": {"dimension": "safety_compliance", "line_item_key": "ac203.push_to_exit_30s"}}, {"id": "motiononly", "label_i18n": "sim.ac203.egress-fail.choice.motiononly.label", "to": "trapped_motion", "consequence_i18n": "sim.ac203.egress-fail.choice.motiononly.consequence", "score_delta": -3, "safety_flag": true, "is_safety_decision": true, "verdict": {"dimension": "safety_compliance", "line_item_key": "ac203.push_to_exit_30s"}}]}, "placement": {"type": "prompt", "prompt_i18n": "sim.ac203.egress-fail.node.placement.prompt", "is_safety_decision": true, "choices": [{"id": "mount_reachable", "label_i18n": "sim.ac203.egress-fail.choice.mount_reachable.label", "to": "firealarm", "consequence_i18n": "sim.ac203.egress-fail.choice.mount_reachable.consequence", "score_delta": 3, "safety_flag": false, "is_safety_decision": true, "verdict": {"dimension": "safety_compliance", "line_item_key": "ac203.pte_mount_40_48in_5ft"}}, {"id": "mount_high", "label_i18n": "sim.ac203.egress-fail.choice.mount_high.label", "to": "trapped_placement", "consequence_i18n": "sim.ac203.egress-fail.choice.mount_high.consequence", "score_delta": -3, "safety_flag": true, "is_safety_decision": true, "verdict": {"dimension": "safety_compliance", "line_item_key": "ac203.pte_mount_40_48in_5ft"}}]}, "firealarm": {"type": "prompt", "prompt_i18n": "sim.ac203.egress-fail.node.firealarm.prompt", "is_safety_decision": true, "choices": [{"id": "facp", "label_i18n": "sim.ac203.egress-fail.choice.facp.label", "to": "closeout", "consequence_i18n": "sim.ac203.egress-fail.choice.facp.consequence", "score_delta": 3, "safety_flag": false, "is_safety_decision": true, "verdict": {"dimension": "safety_compliance", "line_item_key": "ac203.release_on_fire_alarm"}}, {"id": "nofacp", "label_i18n": "sim.ac203.egress-fail.choice.nofacp.label", "to": "trapped_fire", "consequence_i18n": "sim.ac203.egress-fail.choice.nofacp.consequence", "score_delta": -3, "safety_flag": true, "is_safety_decision": true, "verdict": {"dimension": "safety_compliance", "line_item_key": "ac203.release_on_fire_alarm"}}]}, "closeout": {"type": "prompt", "prompt_i18n": "sim.ac203.egress-fail.node.closeout.prompt", "is_safety_decision": false, "choices": [{"id": "document", "label_i18n": "sim.ac203.egress-fail.choice.document.label", "to": "pass", "consequence_i18n": "sim.ac203.egress-fail.choice.document.consequence", "score_delta": 3, "safety_flag": false, "is_safety_decision": false, "verdict": {"dimension": "verification_documentation", "line_item_key": "ac203.verify.three_release_modes_logged"}}, {"id": "packup", "label_i18n": "sim.ac203.egress-fail.choice.packup.label", "to": "fail_docs", "consequence_i18n": "sim.ac203.egress-fail.choice.packup.consequence", "score_delta": -3, "safety_flag": false, "is_safety_decision": false, "verdict": {"dimension": "verification_documentation", "line_item_key": "ac203.verify.three_release_modes_logged"}}]}, "pass": {"type": "terminal", "outcome": "pass", "safety_veto": false, "outcome_i18n": "sim.ac203.egress-fail.terminal.pass.text", "state": {"token": "pass", "shape": "check", "label_i18n": "sim.common.state.pass", "color_role": "success"}}, "fail_docs": {"type": "terminal", "outcome": "fail", "safety_veto": false, "outcome_i18n": "sim.ac203.egress-fail.terminal.fail_docs.text", "state": {"token": "fail", "shape": "cross", "label_i18n": "sim.common.state.fail", "color_role": "danger"}}, "trapped_lock": {"type": "terminal", "outcome": "fail", "safety_veto": true, "outcome_i18n": "sim.ac203.egress-fail.terminal.trapped_lock.text", "media": [{"r2_key": "sims/ac203/crowd-trapped-locked-door.jpg", "kind": "image", "alt_i18n": "sim.ac203.media.crowd_trapped.alt"}], "state": {"token": "safety_veto", "shape": "octagon", "label_i18n": "sim.common.state.safety_stop", "color_role": "danger"}, "replay": {"freeze_node": "trapped_lock", "decided_at_node": "failstate", "overlay_i18n": "sim.ac203.egress-fail.replay.faillocked.overlay"}}, "trapped_motion": {"type": "terminal", "outcome": "fail", "safety_veto": true, "outcome_i18n": "sim.ac203.egress-fail.terminal.trapped_motion.text", "media": [{"r2_key": "sims/ac203/crowd-trapped-locked-door.jpg", "kind": "image", "alt_i18n": "sim.ac203.media.crowd_trapped.alt"}], "state": {"token": "safety_veto", "shape": "octagon", "label_i18n": "sim.common.state.safety_stop", "color_role": "danger"}, "replay": {"freeze_node": "trapped_motion", "decided_at_node": "rex", "overlay_i18n": "sim.ac203.egress-fail.replay.motiononly.overlay"}}, "trapped_placement": {"type": "terminal", "outcome": "fail", "safety_veto": true, "outcome_i18n": "sim.ac203.egress-fail.terminal.trapped_placement.text", "media": [{"r2_key": "sims/ac203/crowd-trapped-locked-door.jpg", "kind": "image", "alt_i18n": "sim.ac203.media.crowd_trapped.alt"}], "state": {"token": "safety_veto", "shape": "octagon", "label_i18n": "sim.common.state.safety_stop", "color_role": "danger"}, "replay": {"freeze_node": "trapped_placement", "decided_at_node": "placement", "overlay_i18n": "sim.ac203.egress-fail.replay.mount_high.overlay"}}, "trapped_fire": {"type": "terminal", "outcome": "fail", "safety_veto": true, "outcome_i18n": "sim.ac203.egress-fail.terminal.trapped_fire.text", "media": [{"r2_key": "sims/ac203/crowd-trapped-locked-door.jpg", "kind": "image", "alt_i18n": "sim.ac203.media.crowd_trapped.alt"}], "state": {"token": "safety_veto", "shape": "octagon", "label_i18n": "sim.common.state.safety_stop", "color_role": "danger"}, "replay": {"freeze_node": "trapped_fire", "decided_at_node": "firealarm", "overlay_i18n": "sim.ac203.egress-fail.replay.nofacp.overlay"}}}}$sim$::jsonb,
   array['000000c0-0000-0000-0000-00000000000f']::uuid[], 'published',
   'NFPA 101 §7.2.1.6.2 (Sensor-Release of Electrical Locking Systems)')
on conflict (key, version) do nothing;

-- FND-102 (cv …002) — SAFETY GATE, 90%
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0002-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000002', 1, 'Ladders, LOTO, PPE & Electrical Safety', 'lesson',          '000000c0-0000-0000-0000-000000000002', 40, '{"mdx_key":"fnd-102/u1","placeholder":true}'::jsonb),
  ('000000c3-0002-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000002', 2, 'Spot the Hazard + Ladder-Setup Simulator','sim',            '000000c0-0000-0000-0000-000000000002', 35, '{"engine":"branching_scenario","spec_key":"fnd-102/spot-the-hazard","placeholder":true}'::jsonb),
  ('000000c3-0002-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000002', 3, 'Safety Exam (90% gate)',                  'knowledge_check', '000000c0-0000-0000-0000-000000000002', 20, '{"item_set":"fnd-102","gate":0.90,"placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- FND-103 (cv …003)
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0003-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000003', 1, 'Cable Families, the 100m Rule & PoE',     'lesson',          '000000c0-0000-0000-0000-000000000003', 45, '{"mdx_key":"fnd-103/u1","placeholder":true}'::jsonb),
  ('000000c3-0003-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000003', 2, 'Virtual Termination Bench + Pull the Run','sim',            '000000c0-0000-0000-0000-000000000003', 40, '{"engine":"interaction_2d","spec_key":"fnd-103/termination-bench","placeholder":true}'::jsonb),
  ('000000c3-0003-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000003', 3, 'Cabling Literacy Exam',                   'knowledge_check', '000000c0-0000-0000-0000-000000000003', 20, '{"item_set":"fnd-103","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- INT-101 (cv …004)
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0004-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000004', 1, 'Work OS at a Glance & the Job Journey',   'lesson',          '000000c0-0000-0000-0000-000000000004', 25, '{"mdx_key":"int-101/u1","placeholder":true}'::jsonb),
  ('000000c3-0004-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000004', 2, 'Run a Job (end-to-end)',                  'sim',             '000000c0-0000-0000-0000-000000000004', 30, '{"engine":"branching_scenario","spec_key":"int-101/run-a-job","placeholder":true}'::jsonb),
  ('000000c3-0004-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000004', 3, 'Pillars & Closeout-Quartet Check',        'knowledge_check', '000000c0-0000-0000-0000-000000000004', 15, '{"item_set":"int-101","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- INT-102 (cv …005)
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0005-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000005', 1, 'Offline-First Field Execution',           'lesson',          '000000c0-0000-0000-0000-000000000005', 20, '{"mdx_key":"int-102/u1","placeholder":true}'::jsonb),
  ('000000c3-0005-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000005', 2, 'Offline Field-Run (dead-zone mode)',      'sim',             '000000c0-0000-0000-0000-000000000005', 30, '{"engine":"branching_scenario","spec_key":"int-102/offline-field-run","placeholder":true}'::jsonb),
  ('000000c3-0005-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000005', 3, 'Field Work OS Check',                     'knowledge_check', '000000c0-0000-0000-0000-000000000005', 12, '{"item_set":"int-102","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- ADC-101 (cv …006)
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0006-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000006', 1, 'Alarm.com Positioning & the Partner Model','lesson',         '000000c0-0000-0000-0000-000000000006', 25, '{"mdx_key":"adc-101/u1","placeholder":true}'::jsonb),
  ('000000c3-0006-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000006', 2, 'Sort the Stack (ADC vs Not-ADC)',         'sim',             '000000c0-0000-0000-0000-000000000006', 15, '{"engine":"interaction_2d","spec_key":"adc-101/sort-the-stack","placeholder":true}'::jsonb),
  ('000000c3-0006-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000006', 3, 'Ecosystem Concept Check',                 'knowledge_check', '000000c0-0000-0000-0000-000000000006', 12, '{"item_set":"adc-101","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- ADC-102 (cv …007)
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0007-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000007', 1, 'Login, 2FA & the Top-Bar Map',            'lesson',          '000000c0-0000-0000-0000-000000000007', 30, '{"mdx_key":"adc-102/u1","placeholder":true}'::jsonb),
  ('000000c3-0007-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000007', 2, 'Portal Scavenger Hunt',                   'sim',             '000000c0-0000-0000-0000-000000000007', 25, '{"engine":"device_config","spec_key":"adc-102/portal-scavenger","fixture":"adc_portal","placeholder":true}'::jsonb),
  ('000000c3-0007-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000007', 3, 'Portal Navigator Check',                  'knowledge_check', '000000c0-0000-0000-0000-000000000007', 12, '{"item_set":"adc-102","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- ADC-201 (cv …008)
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0008-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000008', 1, 'Create-Customer, Logins vs User Codes',   'lesson',          '000000c0-0000-0000-0000-000000000008', 40, '{"mdx_key":"adc-201/u1","placeholder":true}'::jsonb),
  ('000000c3-0008-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000008', 2, 'Account-Creation Sim + Last-Name Bug',    'sim',             '000000c0-0000-0000-0000-000000000008', 45, '{"engine":"device_config","spec_key":"adc-201/create-customer","fixture":"adc_portal","placeholder":true}'::jsonb),
  ('000000c3-0008-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000008', 3, 'Account Steward Check',                   'knowledge_check', '000000c0-0000-0000-0000-000000000008', 15, '{"item_set":"adc-201","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- AC-101 (cv …009)
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-0009-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000009', 1, 'The Five Components & the Access Event',   'lesson',          '000000c0-0000-0000-0000-000000000009', 30, '{"mdx_key":"ac-101/u1","placeholder":true}'::jsonb),
  ('000000c3-0009-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000009', 2, 'Anatomy of a Door (drag-label + order)',  'sim',             '000000c0-0000-0000-0000-000000000009', 25, '{"engine":"interaction_2d","spec_key":"ac-101/anatomy-of-a-door","placeholder":true}'::jsonb),
  ('000000c3-0009-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000009', 3, 'Access Control Knowledge Check',          'knowledge_check', '000000c0-0000-0000-0000-000000000009', 15, '{"item_set":"ac-101","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- AC-102 (cv …00a) — fail-safe/fail-locked items gate at 90%
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-000a-0000-0000-000000000001', '000000c2-0000-0000-0000-00000000000a', 1, 'Credentials, OSDP vs Wiegand & Lock Families','lesson',       '000000c0-0000-0000-0000-00000000000a', 45, '{"mdx_key":"ac-102/u1","placeholder":true}'::jsonb),
  ('000000c3-000a-0000-0000-000000000002', '000000c2-0000-0000-0000-00000000000a', 2, 'Spec the Door (credential & lock matcher)','sim',            '000000c0-0000-0000-0000-00000000000a', 35, '{"engine":"interaction_2d","spec_key":"ac-102/spec-the-door","placeholder":true}'::jsonb),
  ('000000c3-000a-0000-0000-000000000003', '000000c2-0000-0000-0000-00000000000a', 3, 'Hardware & Fail-State Check',             'knowledge_check', '000000c0-0000-0000-0000-00000000000b', 18, '{"item_set":"ac-102","safety_subset":"fail_state","placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- AC-103 (cv …00b) — EGRESS awareness, 90%
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-000b-0000-0000-000000000001', '000000c2-0000-0000-0000-00000000000b', 1, 'Free Egress, §7.2.1.6 & the Headline Numbers','lesson',       '000000c0-0000-0000-0000-00000000000c', 40, '{"mdx_key":"ac-103/u1","placeholder":true}'::jsonb),
  ('000000c3-000b-0000-0000-000000000002', '000000c2-0000-0000-0000-00000000000b', 2, 'Trapped or Free? (egress branching, mandatory)','scenario',  '000000c0-0000-0000-0000-00000000000c', 30, '{"engine":"branching_scenario","spec_key":"ac-103/trapped-or-free","mandatory":true,"placeholder":true}'::jsonb),
  ('000000c3-000b-0000-0000-000000000003', '000000c2-0000-0000-0000-00000000000b', 3, 'Egress & Life-Safety Exam (90% gate)',    'knowledge_check', '000000c0-0000-0000-0000-00000000000c', 20, '{"item_set":"ac-103","gate":0.90,"placeholder":true}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- AC-201 (cv …00c) — device-config (Aero) + WebGL Virtual Door + signoff_prep
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-000c-0000-0000-000000000001', '000000c2-0000-0000-0000-00000000000c', 1, 'The Aero X1100 Kit, Terminals & Fail-State', 'lesson',         '000000c0-0000-0000-0000-00000000000d', 45, '{"mdx_key":"ac-201/u1","placeholder":true}'::jsonb),
  ('000000c3-000c-0000-0000-000000000002', '000000c2-0000-0000-0000-00000000000c', 2, '3D Virtual Door — Aero Edition',          'sim',             '000000c0-0000-0000-0000-00000000000d', 60, '{"engine":"webgl_install","spec_key":"ac-201/virtual-door-aero","placeholder":true}'::jsonb),
  ('000000c3-000c-0000-0000-000000000003', '000000c2-0000-0000-0000-00000000000c', 3, 'Aero Cloud Commissioning (Partner Portal)','sim',            '000000c0-0000-0000-0000-00000000000d', 30, '{"engine":"device_config","spec_key":"ac-201/aero-commission","fixture":"adc_portal","placeholder":true}'::jsonb),
  ('000000c3-000c-0000-0000-000000000004', '000000c2-0000-0000-0000-00000000000c', 4, 'Field Sign-Off Prep — Single-Door Aero',  'signoff_prep',    '000000c0-0000-0000-0000-00000000000d', 20, '{"placeholder":true,"signoff_rubric_template_ref":"academy.signoff_line_item_templates","course":"AC-201"}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- AC-202 (cv …00d) — calculator (PoE/will-it-hold) + device-config (Mercury) + signoff_prep
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-000d-0000-0000-000000000001', '000000c2-0000-0000-0000-00000000000d', 1, 'LP1501 vs LP1502, PoE & Reader Wiring',   'lesson',          '000000c0-0000-0000-0000-00000000000e', 45, '{"mdx_key":"ac-202/u1","placeholder":true}'::jsonb),
  ('000000c3-000d-0000-0000-000000000002', '000000c2-0000-0000-0000-00000000000d', 2, 'PoE Budget + Will-It-Hold Calculator',    'sim',             '000000c0-0000-0000-0000-00000000000e', 30, '{"engine":"calculator","spec_key":"ac-202/will-it-hold","placeholder":true}'::jsonb),
  ('000000c3-000d-0000-0000-000000000003', '000000c2-0000-0000-0000-00000000000d', 3, '3D Virtual Door — Mercury Edition',       'sim',             '000000c0-0000-0000-0000-00000000000e', 60, '{"engine":"webgl_install","spec_key":"ac-202/virtual-door-mercury","placeholder":true}'::jsonb),
  ('000000c3-000d-0000-0000-000000000004', '000000c2-0000-0000-0000-00000000000d', 4, 'Field Sign-Off Prep — Mercury Wiring',    'signoff_prep',    '000000c0-0000-0000-0000-00000000000e', 20, '{"placeholder":true,"signoff_rubric_template_ref":"academy.signoff_line_item_templates","course":"AC-202"}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- AC-203 (cv …00e) — branching (egress-fail, mandatory) + WebGL build + signoff_prep
-- The §5.4 line-item TEMPLATE incl. the seven ⚠ critical-safety lines (S1 §5 /
-- Course Bible AC-203) lives in academy.signoff_line_item_templates (section 7b —
-- the CANONICAL source M6 finalize-signoff reads). The signoff_prep content_ref
-- carries only a short pointer at that table (the [SCHEMA GAP] is RESOLVED by 0003).
insert into academy.units (id, course_version_id, ordinal, title, kind, competency_id, est_minutes, content_ref) values
  ('000000c3-000e-0000-0000-000000000001', '000000c2-0000-0000-0000-00000000000e', 1, 'Mag-Lock Fundamentals, REX & the Fire Interface','lesson',     '000000c0-0000-0000-0000-00000000000f', 50, '{"mdx_key":"ac-203/u1","placeholder":true}'::jsonb),
  ('000000c3-000e-0000-0000-000000000002', '000000c2-0000-0000-0000-00000000000e', 2, 'Is This Egress Install Code-Compliant? (mandatory)','scenario', '000000c0-0000-0000-0000-00000000000f', 45, '{"engine":"branching_scenario","spec_key":"ac-203/egress-compliant","mandatory":true,"gate":0.90,"placeholder":true}'::jsonb),
  ('000000c3-000e-0000-0000-000000000003', '000000c2-0000-0000-0000-00000000000e', 3, '3D Virtual Door — Mag-Lock + REX + Fire Build','sim',          '000000c0-0000-0000-0000-00000000000f', 60, '{"engine":"webgl_install","spec_key":"ac-203/virtual-door-maglock","gate":0.90,"placeholder":true}'::jsonb),
  ('000000c3-000e-0000-0000-000000000004', '000000c2-0000-0000-0000-00000000000e', 4, 'Field Sign-Off Prep — Egress Hard Gate',  'signoff_prep',    '000000c0-0000-0000-0000-00000000000f', 25, '{"placeholder":true,"signoff_rubric_template_ref":"academy.signoff_line_item_templates","course":"AC-203","gate_note":"EGRESS HARD GATE — safety-veto rubric; a single 0 on any ⚠ critical-safety line is an automatic fail (Inv. 1)."}'::jsonb)
on conflict (course_version_id, ordinal) do nothing;

-- ----------------------------------------------------------------------------
-- 4. UNIT_COMPETENCIES — the many-to-many map (wave3 §7 #7)
-- ----------------------------------------------------------------------------
-- Mirror each unit's primary competency_id into unit_competencies so M1/M2 can
-- resolve unit->competency via the join table too. AC-102's hardware/fail-state
-- check maps BOTH the credential/lock-selection and the fail-state competency
-- (its safety subset). pk (unit_id, competency_id) backs idempotency.
insert into academy.unit_competencies (unit_id, competency_id)
select u.id, u.competency_id
  from academy.units u
  where u.competency_id is not null
    and u.course_version_id in (
      '000000c2-0000-0000-0000-000000000001','000000c2-0000-0000-0000-000000000002',
      '000000c2-0000-0000-0000-000000000003','000000c2-0000-0000-0000-000000000004',
      '000000c2-0000-0000-0000-000000000005','000000c2-0000-0000-0000-000000000006',
      '000000c2-0000-0000-0000-000000000007','000000c2-0000-0000-0000-000000000008',
      '000000c2-0000-0000-0000-000000000009','000000c2-0000-0000-0000-00000000000a',
      '000000c2-0000-0000-0000-00000000000b','000000c2-0000-0000-0000-00000000000c',
      '000000c2-0000-0000-0000-00000000000d','000000c2-0000-0000-0000-00000000000e'
    )
on conflict (unit_id, competency_id) do nothing;

-- AC-102 fail-state check ALSO maps the door-anatomy nothing extra, but the
-- "Spec the Door" sim grants the fail-state judgment competency too (safety).
insert into academy.unit_competencies (unit_id, competency_id) values
  ('000000c3-000a-0000-0000-000000000002', '000000c0-0000-0000-0000-00000000000b')  -- Spec-the-Door -> fail-state judgment
on conflict (unit_id, competency_id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. COURSE_PREREQUISITES — the FULL edge set (ledger §D / S1 closure fixes)
-- ----------------------------------------------------------------------------
-- kind = hard_gate unless the bible marks it advisory (soft). The result MUST be
-- a DAG — asserted at the end of this file. Edge list (child <- requires):
--   FND-102 <- FND-101                          (FND chain)
--   FND-103 <- FND-102
--   INT-102 <- INT-101                          (INT chain; INT-101 is an entry pt)
--   ADC-101 <- FND-101  [soft]                  (light Foundations gate; bible: FND-104, not in slice -> soft on FND-101)
--   ADC-102 <- ADC-101
--   ADC-201 <- ADC-102, INT-101                 (closure: ADC-101->102 makes ADC-201 reachable)
--   AC-101  <- FND-101                           (bible also FND-104 [not in slice]; +FND-103 recommended -> soft)
--   AC-101  <- FND-103  [soft]
--   AC-102  <- AC-101
--   AC-103  <- AC-101, AC-102                    (egress awareness)
--   AC-201  <- AC-101, AC-102, AC-103, FND-102, FND-103, ADC-201   (the missing AC-201<-ADC-201 edge, ledger §D)
--   AC-202  <- AC-201, FND-103
--   AC-203  <- AC-201, AC-202, AC-103, FND-102   (the missing AC-203<-AC-202 closure edge, ledger §D)
-- INT-101 and AC-101's FND-101 root tie the slice together; no cycles.
insert into academy.course_prerequisites (course_id, requires_course_id, kind) values
  -- FND chain
  ('000000c1-0000-0000-0000-000000000002', '000000c1-0000-0000-0000-000000000001', 'hard_gate'),  -- FND-102 <- FND-101
  ('000000c1-0000-0000-0000-000000000003', '000000c1-0000-0000-0000-000000000002', 'hard_gate'),  -- FND-103 <- FND-102
  -- INT chain (INT-101 is an entry point; no prereq seeded in-slice)
  ('000000c1-0000-0000-0000-000000000005', '000000c1-0000-0000-0000-000000000004', 'hard_gate'),  -- INT-102 <- INT-101
  -- ADC chain
  ('000000c1-0000-0000-0000-000000000006', '000000c1-0000-0000-0000-000000000001', 'soft'),       -- ADC-101 <- FND-101 (light; bible FND-104 not in slice)
  ('000000c1-0000-0000-0000-000000000007', '000000c1-0000-0000-0000-000000000006', 'hard_gate'),  -- ADC-102 <- ADC-101
  ('000000c1-0000-0000-0000-000000000008', '000000c1-0000-0000-0000-000000000007', 'hard_gate'),  -- ADC-201 <- ADC-102
  ('000000c1-0000-0000-0000-000000000008', '000000c1-0000-0000-0000-000000000004', 'hard_gate'),  -- ADC-201 <- INT-101
  -- AC chain
  ('000000c1-0000-0000-0000-000000000009', '000000c1-0000-0000-0000-000000000001', 'hard_gate'),  -- AC-101 <- FND-101
  ('000000c1-0000-0000-0000-000000000009', '000000c1-0000-0000-0000-000000000003', 'soft'),       -- AC-101 <- FND-103 (recommended alongside)
  ('000000c1-0000-0000-0000-00000000000a', '000000c1-0000-0000-0000-000000000009', 'hard_gate'),  -- AC-102 <- AC-101
  ('000000c1-0000-0000-0000-00000000000b', '000000c1-0000-0000-0000-000000000009', 'hard_gate'),  -- AC-103 <- AC-101
  ('000000c1-0000-0000-0000-00000000000b', '000000c1-0000-0000-0000-00000000000a', 'hard_gate'),  -- AC-103 <- AC-102
  -- AC-201 <- AC-101, AC-102, AC-103, FND-102, FND-103, ADC-201  (incl. the ledger §D AC-201<-ADC-201 edge)
  ('000000c1-0000-0000-0000-00000000000c', '000000c1-0000-0000-0000-000000000009', 'hard_gate'),  -- AC-201 <- AC-101
  ('000000c1-0000-0000-0000-00000000000c', '000000c1-0000-0000-0000-00000000000a', 'hard_gate'),  -- AC-201 <- AC-102
  ('000000c1-0000-0000-0000-00000000000c', '000000c1-0000-0000-0000-00000000000b', 'hard_gate'),  -- AC-201 <- AC-103
  ('000000c1-0000-0000-0000-00000000000c', '000000c1-0000-0000-0000-000000000002', 'hard_gate'),  -- AC-201 <- FND-102
  ('000000c1-0000-0000-0000-00000000000c', '000000c1-0000-0000-0000-000000000003', 'hard_gate'),  -- AC-201 <- FND-103
  ('000000c1-0000-0000-0000-00000000000c', '000000c1-0000-0000-0000-000000000008', 'hard_gate'),  -- AC-201 <- ADC-201  (ledger §D closure)
  -- AC-202 <- AC-201, FND-103
  ('000000c1-0000-0000-0000-00000000000d', '000000c1-0000-0000-0000-00000000000c', 'hard_gate'),  -- AC-202 <- AC-201
  ('000000c1-0000-0000-0000-00000000000d', '000000c1-0000-0000-0000-000000000003', 'hard_gate'),  -- AC-202 <- FND-103
  -- AC-203 <- AC-201, AC-202, AC-103, FND-102  (incl. the ledger §D AC-203<-AC-202 closure edge)
  ('000000c1-0000-0000-0000-00000000000e', '000000c1-0000-0000-0000-00000000000c', 'hard_gate'),  -- AC-203 <- AC-201
  ('000000c1-0000-0000-0000-00000000000e', '000000c1-0000-0000-0000-00000000000d', 'hard_gate'),  -- AC-203 <- AC-202  (ledger §D closure)
  ('000000c1-0000-0000-0000-00000000000e', '000000c1-0000-0000-0000-00000000000b', 'hard_gate'),  -- AC-203 <- AC-103
  ('000000c1-0000-0000-0000-00000000000e', '000000c1-0000-0000-0000-000000000002', 'hard_gate')   -- AC-203 <- FND-102 (safety gate)
on conflict (course_id, requires_course_id) do nothing;

-- ----------------------------------------------------------------------------
-- 5b. COURSE_PLATFORM_DEPENDENCIES — normalized manifest for recert targeting (§8)
-- ----------------------------------------------------------------------------
-- A vendor change on platform_key then lists every affected course (the §8 triage
-- join). Mirrors the platform_manifest jsonb above into queryable rows.
insert into academy.course_platform_dependencies (course_id, platform_key, min_version, max_version) values
  ('000000c1-0000-0000-0000-000000000007', 'adc_partner_portal', null, null),  -- ADC-102
  ('000000c1-0000-0000-0000-000000000008', 'adc_partner_portal', null, null),  -- ADC-201
  ('000000c1-0000-0000-0000-00000000000c', 'adc_partner_portal', null, null),  -- AC-201 cloud step
  ('000000c1-0000-0000-0000-00000000000c', 'adc_aero_x1100',     null, null),  -- AC-201 Aero
  ('000000c1-0000-0000-0000-00000000000d', 'mercury_lp1501',     null, null),  -- AC-202
  ('000000c1-0000-0000-0000-00000000000d', 'mercury_lp1502',     null, null),  -- AC-202
  ('000000c1-0000-0000-0000-00000000000e', 'securitron_maglock_1200s', null, null)  -- AC-203 mag lock
on conflict (course_id, platform_key) do nothing;

-- ----------------------------------------------------------------------------
-- 6. ASSESSMENT_ITEMS — a representative set per course (is_safety_item per §C)
-- ----------------------------------------------------------------------------
-- ledger §C: is_safety_item=true moves the gate to the ITEM level (>=90%);
-- non-safety items gate at >=80%. Per S1 §4: AC-102 fail-safe/fail-locked items
-- and ALL AC-103/AC-203 egress items = is_safety_item=true; FND-102 safety items
-- true; others false. prompt/options/answer_key are minimal valid JSONB stubs
-- (real item bodies authored in M2; this seeds the gate-bearing shape the mastery
-- engine reads). competency_id + course_version_id are required FKs.
--
-- [SCHEMA GAP — RESOLVED by 0003] academy.signoff_line_items.signoff_id is NOT NULL
-- and FKs a live academy.signoffs row, so it can only hold SCORED INSTANCES, never
-- the rubric TEMPLATE. That template is now a first-class table,
-- academy.signoff_line_item_templates (migrations/0003_signoff_line_item_templates.sql),
-- seeded in section 7b — the CANONICAL source. M6 finalize-signoff reads THAT table
-- to materialize signoff_line_items per actual sign-off (preserving dimension +
-- is_critical_safety). The signoff_prep unit content_ref (section 3d) now carries
-- only a short pointer at the table. The seven AC-203 ⚠ keys + the AC-201/202 lines
-- are enumerated in section 7b. See SEED_NOTES §4.

-- helper macro pattern: (id, competency_id, course_version_id, kind, prompt, answer_key, is_safety_item)
insert into academy.assessment_items (id, competency_id, course_version_id, kind, prompt, options, answer_key, is_safety_item, mastery_weight) values
  -- FND-101 (non-safety)
  ('000000a5-0001-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000001', 'mcq',          '{"text":"Name the five Work OS pillars.","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  ('000000a5-0001-0000-0000-000000000002', '000000c0-0000-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000001', 'multi_select', '{"text":"Which are Redex service-ecosystem offerings?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  -- FND-102 (SAFETY — 90%)
  ('000000a5-0002-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000002', 'numeric',      '{"text":"What ladder angle ratio meets OSHA (run:rise)?","placeholder":true}'::jsonb, null, '{"value":"4:1","placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-0002-0000-0000-000000000002', '000000c0-0000-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000002', 'mcq',          '{"text":"Before working on a circuit you must…","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-0002-0000-0000-000000000003', '000000c0-0000-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000002', 'scenario_branch','{"text":"A manager pressures you to skip lockout. Choose.","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  -- FND-103 (non-safety)
  ('000000a5-0003-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000003', 'numeric',      '{"text":"Max channel length for Cat6 (meters)?","placeholder":true}'::jsonb, null, '{"value":100,"placeholder":true}'::jsonb, false, 1.0),
  ('000000a5-0003-0000-0000-000000000002', '000000c0-0000-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000003', 'mcq',          '{"text":"Match the PoE class to the device.","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  -- INT-101 (non-safety)
  ('000000a5-0004-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000004', '000000c2-0000-0000-0000-000000000004', 'multi_select', '{"text":"What is the closeout quartet?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  -- INT-102 (non-safety)
  ('000000a5-0005-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000005', '000000c2-0000-0000-0000-000000000005', 'mcq',          '{"text":"What must you confirm before leaving an offline job?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  -- ADC-101 (non-safety)
  ('000000a5-0006-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000006', '000000c2-0000-0000-0000-000000000006', 'mcq',          '{"text":"At Redex, video is owned by which platform?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  -- ADC-102 (non-safety)
  ('000000a5-0007-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000007', '000000c2-0000-0000-0000-000000000007', 'mcq',          '{"text":"Why does dealer login hygiene matter?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  -- ADC-201 (non-safety)
  ('000000a5-0008-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000008', '000000c2-0000-0000-0000-000000000008', 'mcq',          '{"text":"Logins vs user codes: which controls panel/door access?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  ('000000a5-0008-0000-0000-000000000002', '000000c0-0000-0000-0000-000000000008', '000000c2-0000-0000-0000-000000000008', 'scenario_branch','{"text":"The last name reverts to the first name. What do you do?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  -- AC-101 (non-safety)
  ('000000a5-0009-0000-0000-000000000001', '000000c0-0000-0000-0000-000000000009', '000000c2-0000-0000-0000-000000000009', 'order',        '{"text":"Order the access-event sequence.","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  ('000000a5-0009-0000-0000-000000000002', '000000c0-0000-0000-0000-000000000009', '000000c2-0000-0000-0000-000000000009', 'hotspot',      '{"text":"Tap the side that must always allow free egress.","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  -- AC-102 (fail-safe/fail-locked items = SAFETY 90%; others non-safety)
  ('000000a5-000a-0000-0000-000000000001', '000000c0-0000-0000-0000-00000000000a', '000000c2-0000-0000-0000-00000000000a', 'mcq',          '{"text":"List three OSDP advantages over Wiegand.","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  ('000000a5-000a-0000-0000-000000000002', '000000c0-0000-0000-0000-00000000000b', '000000c2-0000-0000-0000-00000000000a', 'mcq',          '{"text":"Fail-SAFE: what does the lock do on power loss?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-000a-0000-0000-000000000003', '000000c0-0000-0000-0000-00000000000b', '000000c2-0000-0000-0000-00000000000a', 'mcq',          '{"text":"Which lock is correct on a fire-rated door (fail-secure vs fail-safe)?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  -- AC-103 (ALL egress items = SAFETY 90%)
  ('000000a5-000b-0000-0000-000000000001', '000000c0-0000-0000-0000-00000000000c', '000000c2-0000-0000-0000-00000000000b', 'numeric',      '{"text":"Push-to-exit mounting height range (inches)?","placeholder":true}'::jsonb, null, '{"value":"40-48","placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-000b-0000-0000-000000000002', '000000c0-0000-0000-0000-00000000000c', '000000c2-0000-0000-0000-00000000000b', 'numeric',      '{"text":"Minimum push-to-exit release duration (seconds)?","placeholder":true}'::jsonb, null, '{"value":30,"placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-000b-0000-0000-000000000003', '000000c0-0000-0000-0000-00000000000c', '000000c2-0000-0000-0000-00000000000b', 'scenario_branch','{"text":"Trapped or free? Walk the fire-alarm path.","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-000b-0000-0000-000000000004', '000000c0-0000-0000-0000-00000000000c', '000000c2-0000-0000-0000-00000000000b', 'mcq',          '{"text":"Who has final authority on a code requirement?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  -- AC-201 (Aero; fail-state item = safety; others non-safety)
  ('000000a5-000c-0000-0000-000000000001', '000000c0-0000-0000-0000-00000000000d', '000000c2-0000-0000-0000-00000000000c', 'mcq',          '{"text":"The Aero relay is a switch, not a…","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  ('000000a5-000c-0000-0000-000000000002', '000000c0-0000-0000-0000-00000000000b', '000000c2-0000-0000-0000-00000000000c', 'mcq',          '{"text":"You must confirm the door''s fail-state before…","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  -- AC-202 (Mercury; lock-power/backup adequacy = safety; others non-safety)
  ('000000a5-000d-0000-0000-000000000001', '000000c0-0000-0000-0000-00000000000e', '000000c2-0000-0000-0000-00000000000d', 'mcq',          '{"text":"Does PoE on the LP1501 power the lock load?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, false, 1.0),
  ('000000a5-000d-0000-0000-000000000002', '000000c0-0000-0000-0000-00000000000e', '000000c2-0000-0000-0000-00000000000d', 'numeric',      '{"text":"Will it hold? Compute the voltage at the mag lock.","placeholder":true}'::jsonb, null, '{"placeholder":true}'::jsonb, true, 1.0),
  -- AC-203 (ALL egress items = SAFETY 90%; the gate course)
  ('000000a5-000e-0000-0000-000000000001', '000000c0-0000-0000-0000-00000000000f', '000000c2-0000-0000-0000-00000000000e', 'mcq',          '{"text":"Is a motion REX alone a code-compliant release for a mag lock?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-000e-0000-0000-000000000002', '000000c0-0000-0000-0000-00000000000f', '000000c2-0000-0000-0000-00000000000e', 'scenario_branch','{"text":"The fire alarm fires. Does your build release everyone?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-000e-0000-0000-000000000003', '000000c0-0000-0000-0000-00000000000f', '000000c2-0000-0000-0000-00000000000e', 'mcq',          '{"text":"May a mag lock be used on a fire-rated, positively-latching door?","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0),
  ('000000a5-000e-0000-0000-000000000004', '000000c0-0000-0000-0000-00000000000f', '000000c2-0000-0000-0000-00000000000e', 'order',        '{"text":"Order the three release modes you must verify.","placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, '{"placeholder":true}'::jsonb, true, 1.0)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. BADGE_CLASSES — slice skill badges + the AC tier credential (ledger §D/§F)
-- ----------------------------------------------------------------------------
-- requires (jsonb) encodes stackability (the credential-as-prerequisite stack):
--   * skill badges: { competency: <code>, signoff_required: true } — issued only
--     after a calibrated Evaluator field sign-off proves the competency
--     (field_proven). One skill badge per SIGNABLE (field-proven) competency in
--     the slice: AC-201, AC-202, AC-203.
--   * tier credential "Certified Technician — Access Control": kind='tier',
--     requires.badges = the three slice skill badge keys (the resolver/auto-issue
--     reads this — M7). is_compliance=true + recert_months=12 for the egress
--     12-month rule (ledger §D / Course Bible recert cadence).
-- recert_months on the skill badges: 12 for the egress/safety-critical AC-203
-- (and AC-201/202 carry the access-control field cadence; set 24 = Core default,
-- AC-203 = 12 egress). is_compliance=true on the egress-bearing credentials.
insert into academy.badge_classes (id, key, kind, title, description, requires, recert_months, is_compliance, alignment) values
  -- Skill badge: Single-Door Aero Commissioning (AC-201)
  ('000000b9-0000-0000-0000-000000000001', 'skill.ac.single_door_aero', 'skill',
     'Single-Door Aero Commissioning',
     'Commissions one ADC-AC Aero door end-to-end (wire, fail-state, cloud, verify). Issued after an Evaluator field sign-off (AC-201).',
     '{"competency":"AC.AERO_SINGLE_DOOR","signoff_required":true,"courses":["AC-201"]}'::jsonb,
     24, false, '{"nicet":["I"]}'::jsonb),
  -- Skill badge: Mercury LP1501/LP1502 Wiring (AC-202)
  ('000000b9-0000-0000-0000-000000000002', 'skill.ac.mercury_wiring', 'skill',
     'Mercury LP1501/LP1502 Wiring',
     'Selects and wires Mercury LP1501/LP1502 panels (power, readers, lock/REX/DPS, supervision). Issued after an Evaluator field sign-off (AC-202).',
     '{"competency":"AC.MERCURY_WIRING","signoff_required":true,"courses":["AC-202"]}'::jsonb,
     24, false, '{"nicet":["I","II"]}'::jsonb),
  -- Skill badge: Mag Lock + REX + Egress Wiring (AC-203) — GATING, egress, 12-mo
  ('000000b9-0000-0000-0000-000000000003', 'skill.ac.maglock_rex_egress', 'skill',
     'Mag Lock + REX + Egress Wiring',
     'Wires a mag lock fail-safe with REX, push-to-exit and fire-alarm release; proves all three release modes. Gating egress badge, issued after the AC-203 safety-veto field sign-off.',
     '{"competency":"EGRESS.MAGLOCK_FAILSAFE","signoff_required":true,"courses":["AC-203"],"gating":true}'::jsonb,
     12, true, '{"nfpa":["101 §7.2.1.6.2"],"nicet":["II"]}'::jsonb),
  -- Tier credential: Certified Technician — Access Control (the AC Core track)
  ('000000b9-0000-0000-0000-000000000004', 'tier.ac.certified_technician', 'tier',
     'Certified Technician — Access Control',
     'The Redex Access-Control Core tier credential. Auto-issues when the component skill badges are all field_proven (resolver in M7). Encompasses single-door Aero, Mercury wiring, and the egress hard-gate.',
     '{"badges":["skill.ac.single_door_aero","skill.ac.mercury_wiring","skill.ac.maglock_rex_egress"],"auto_issue":"all_components_field_proven","competencies":["AC.AERO_SINGLE_DOOR","AC.MERCURY_WIRING","EGRESS.MAGLOCK_FAILSAFE"]}'::jsonb,
     12, true, '{"esa":["CAT L1"],"nicet":["I","II"]}'::jsonb)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 7b. SIGNOFF_LINE_ITEM_TEMPLATES — the §5.4 rubric line-item CATALOG (CANONICAL)
-- ----------------------------------------------------------------------------
-- The per-course §5.4 sign-off rubric, as first-class rows (table added by
-- migrations/0003_signoff_line_item_templates.sql — apply it before this seed).
-- This is the CANONICAL source of the rubric lines: M6 finalize-signoff reads
-- THIS table to materialize one academy.signoff_line_items row per template line
-- on each actual sign-off, preserving dimension + is_critical_safety so the
-- safety-veto trigger (0001 tg_signoff_compute_outcome) fires correctly. This
-- RESOLVES the former [SCHEMA GAP] (signoff_line_items.signoff_id is NOT NULL, so
-- it can only hold scored instances, never templates — see SEED_NOTES §4).
--
-- Keys/dimensions/is_critical_safety/labels are IDENTICAL to the S1 §5 / Course
-- Bible blocks (the same values previously inlined in the signoff_prep
-- content_ref). AC-203 keeps all 7 ⚠ critical-safety lines. competency_id links
-- each course's signable competency. ordinal preserves rubric order.
-- UUID scheme: 000000b1-CCCC-0000-0000-0000000000LL (CCCC=course slot, LL=line).
-- unique (course_id, line_item_key) backs the idempotent ON CONFLICT.

-- AC-201 (course …000c, competency AC.AERO_SINGLE_DOOR …000d) — 9 lines (2 ⚠)
insert into academy.signoff_line_item_templates (id, course_id, competency_id, dimension, line_item_key, is_critical_safety, ordinal, label) values
  ('000000b1-000c-0000-0000-000000000001', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'safety_compliance',          'ac201.failstate_set_before_energize', true,  1, 'Correct fail-state set for the door''s egress role before energizing'),
  ('000000b1-000c-0000-0000-000000000002', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'safety_compliance',          'ac201.no_egress_block',               true,  2, 'No egress-blocking condition created'),
  ('000000b1-000c-0000-0000-000000000003', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'safety_compliance',          'ac201.line_lowvoltage_separation',    false, 3, 'Line/low-voltage separation maintained'),
  ('000000b1-000c-0000-0000-000000000004', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'safety_compliance',          'ac201.lockout_during_wiring',         false, 4, 'Lockout observed during wiring'),
  ('000000b1-000c-0000-0000-000000000005', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'technical_execution',        'ac201.tech.terminations_polarity',    false, 5, 'Correct terminations and polarity'),
  ('000000b1-000c-0000-0000-000000000006', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'technical_execution',        'ac201.tech.lock_via_relay',           false, 6, 'Lock switched via relay (not powered through it)'),
  ('000000b1-000c-0000-0000-000000000007', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'technical_execution',        'ac201.tech.clean_supported_cable',    false, 7, 'Clean, supported cabling'),
  ('000000b1-000c-0000-0000-000000000008', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'verification_documentation', 'ac201.verify.live_event_confirmed',   false, 8, 'Badge-unlock, REX-release, DPS-report and cloud-event confirmed live, logged with photos'),
  ('000000b1-000c-0000-0000-000000000009', '000000c1-0000-0000-0000-00000000000c', '000000c0-0000-0000-0000-00000000000d', 'independence_judgment',      'ac201.indep.escalated_egress',        false, 9, 'Completed unaided; escalated to egress knowledge when the door role required it')
on conflict (course_id, line_item_key) do nothing;

-- AC-202 (course …000d, competency AC.MERCURY_WIRING …000e) — 8 lines (2 ⚠)
insert into academy.signoff_line_item_templates (id, course_id, competency_id, dimension, line_item_key, is_critical_safety, ordinal, label) values
  ('000000b1-000d-0000-0000-000000000001', '000000c1-0000-0000-0000-00000000000d', '000000c0-0000-0000-0000-00000000000e', 'safety_compliance',          'ac202.failstate_and_lock_power',      true,  1, 'Correct fail-state and lock power/backup adequacy'),
  ('000000b1-000d-0000-0000-000000000002', '000000c1-0000-0000-0000-00000000000d', '000000c0-0000-0000-0000-00000000000e', 'safety_compliance',          'ac202.no_egress_block',               true,  2, 'No egress block created'),
  ('000000b1-000d-0000-0000-000000000003', '000000c1-0000-0000-0000-00000000000d', '000000c0-0000-0000-0000-00000000000e', 'safety_compliance',          'ac202.poe_line_safety',               false, 3, 'PoE/line safety observed'),
  ('000000b1-000d-0000-0000-000000000004', '000000c1-0000-0000-0000-00000000000d', '000000c0-0000-0000-0000-00000000000e', 'technical_execution',        'ac202.tech.reader_protocol_cable',    false, 4, 'Correct reader protocol/cable (RS-485 for OSDP)'),
  ('000000b1-000d-0000-0000-000000000005', '000000c1-0000-0000-0000-00000000000d', '000000c0-0000-0000-0000-00000000000e', 'technical_execution',        'ac202.tech.terminations_supervision', false, 5, 'Correct terminations and input supervision'),
  ('000000b1-000d-0000-0000-000000000006', '000000c1-0000-0000-0000-00000000000d', '000000c0-0000-0000-0000-00000000000e', 'technical_execution',        'ac202.tech.gauge_run_appropriate',    false, 6, 'Gauge/run appropriate (no voltage-drop starvation)'),
  ('000000b1-000d-0000-0000-000000000007', '000000c1-0000-0000-0000-00000000000d', '000000c0-0000-0000-0000-00000000000e', 'verification_documentation', 'ac202.verify.panel_online_cycle',     false, 7, 'Panel online, door cycles correctly, documented'),
  ('000000b1-000d-0000-0000-000000000008', '000000c1-0000-0000-0000-00000000000d', '000000c0-0000-0000-0000-00000000000e', 'independence_judgment',      'ac202.indep.right_controller_escalation', false, 8, 'Selected the right controller; escalated egress questions appropriately')
on conflict (course_id, line_item_key) do nothing;

-- AC-203 (course …000e, competency EGRESS.MAGLOCK_FAILSAFE …000f) — 12 lines, the
-- SEVEN ⚠ critical-safety egress lines (a single 0 => automatic fail, Inv. 1) + 5 non-critical.
insert into academy.signoff_line_item_templates (id, course_id, competency_id, dimension, line_item_key, is_critical_safety, ordinal, label) values
  ('000000b1-000e-0000-0000-000000000001', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'safety_compliance',          'ac203.release_on_power_loss',           true,  1, 'Door releases on power loss'),
  ('000000b1-000e-0000-0000-000000000002', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'safety_compliance',          'ac203.push_to_exit_30s',                true,  2, 'Releases on push-to-exit for the full >=30s'),
  ('000000b1-000e-0000-0000-000000000003', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'safety_compliance',          'ac203.release_on_fire_alarm',           true,  3, 'Releases on fire-alarm activation'),
  ('000000b1-000e-0000-0000-000000000004', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'safety_compliance',          'ac203.pte_mount_40_48in_5ft',           true,  4, 'Push-to-exit mounted 40-48in, within 5ft, signed'),
  ('000000b1-000e-0000-0000-000000000005', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'safety_compliance',          'ac203.no_maglock_defeat_fire_latch',    true,  5, 'Mag lock not used to defeat positive latching on a fire-rated door'),
  ('000000b1-000e-0000-0000-000000000006', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'safety_compliance',          'ac203.emergency_lighting_present',      true,  6, 'Emergency lighting present'),
  ('000000b1-000e-0000-0000-000000000007', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'safety_compliance',          'ac203.ahj_confirmed',                   true,  7, 'AHJ confirmed'),
  ('000000b1-000e-0000-0000-000000000008', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'technical_execution',        'ac203.tech.fail_safe_wiring',           false, 8, 'Correct fail-safe wiring'),
  ('000000b1-000e-0000-0000-000000000009', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'technical_execution',        'ac203.tech.rex_fire_terminated',        false, 9, 'REX and fire interface terminated'),
  ('000000b1-000e-0000-0000-00000000000a', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'technical_execution',        'ac203.tech.supply_battery_sized',       false, 10, 'Supply/battery sized'),
  ('000000b1-000e-0000-0000-00000000000b', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'verification_documentation', 'ac203.verify.three_release_modes_logged', false, 11, 'All three release modes tested live and logged'),
  ('000000b1-000e-0000-0000-00000000000c', '000000c1-0000-0000-0000-00000000000e', '000000c0-0000-0000-0000-00000000000f', 'independence_judgment',      'ac203.indep.recognize_no_maglock_escalate', false, 12, 'Recognized when a door should not have a mag lock and escalated')
on conflict (course_id, line_item_key) do nothing;

-- ----------------------------------------------------------------------------
-- 8. POST-SEED ASSERTIONS — fail loudly if the seed is structurally wrong
-- ----------------------------------------------------------------------------
do $$
declare
  v_courses int;
  v_versions int;
  v_prereqs int;
  v_ac201_tmpl int;
  v_ac202_tmpl int;
  v_ac203_tmpl int;
  v_ac203_safety int;
  v_tier_badge_requires jsonb;
begin
  -- Exactly the 14 slice courses are present (seeded set; >= tolerates a
  -- pre-existing superset but the slice codes must all exist).
  select count(*) into v_courses from academy.courses
    where code in ('FND-101','FND-102','FND-103','INT-101','INT-102','ADC-101','ADC-102',
                   'ADC-201','AC-101','AC-102','AC-103','AC-201','AC-202','AC-203');
  if v_courses <> 14 then
    raise exception 'SEED CHECK: expected 14 slice courses, found %', v_courses;
  end if;

  -- Every slice course has a published v1.0.0 with active_version_id wired.
  select count(*) into v_versions from academy.courses c
    join academy.course_versions v on v.id = c.active_version_id
    where c.code in ('FND-101','FND-102','FND-103','INT-101','INT-102','ADC-101','ADC-102',
                     'ADC-201','AC-101','AC-102','AC-103','AC-201','AC-202','AC-203')
      and v.semver = '1.0.0' and v.status = 'published';
  if v_versions <> 14 then
    raise exception 'SEED CHECK: expected 14 active published v1.0.0 versions, found %', v_versions;
  end if;

  -- The corrected closure edges exist (ledger §D): AC-201<-ADC-201, AC-203<-AC-202,
  -- ADC-201<-ADC-102, ADC-201<-INT-101.
  select count(*) into v_prereqs from academy.course_prerequisites cp
    join academy.courses c  on c.id  = cp.course_id
    join academy.courses rc on rc.id = cp.requires_course_id
    where (c.code,rc.code) in (('AC-201','ADC-201'),('AC-203','AC-202'),
                               ('ADC-201','ADC-102'),('ADC-201','INT-101'));
  if v_prereqs <> 4 then
    raise exception 'SEED CHECK: expected the 4 closure prereq edges, found %', v_prereqs;
  end if;

  -- The §5.4 rubric templates are now first-class rows in
  -- academy.signoff_line_item_templates (the CANONICAL source, 0003) — verify the
  -- per-course line counts and the AC-203 critical-safety set from the TABLE.
  select count(*) into v_ac201_tmpl from academy.signoff_line_item_templates t
    where t.course_id = '000000c1-0000-0000-0000-00000000000c';   -- AC-201
  select count(*) into v_ac202_tmpl from academy.signoff_line_item_templates t
    where t.course_id = '000000c1-0000-0000-0000-00000000000d';   -- AC-202
  select count(*) into v_ac203_tmpl from academy.signoff_line_item_templates t
    where t.course_id = '000000c1-0000-0000-0000-00000000000e';   -- AC-203
  if v_ac201_tmpl <> 9 or v_ac202_tmpl <> 8 or v_ac203_tmpl <> 12 then
    raise exception 'SEED CHECK: signoff rubric template counts wrong (AC-201=% expected 9, AC-202=% expected 8, AC-203=% expected 12)',
      v_ac201_tmpl, v_ac202_tmpl, v_ac203_tmpl;
  end if;

  -- AC-203 must carry exactly the 7 ⚠ critical-safety lines (these feed M6's veto).
  select count(*) into v_ac203_safety from academy.signoff_line_item_templates t
    where t.course_id = '000000c1-0000-0000-0000-00000000000e'
      and t.is_critical_safety;
  if v_ac203_safety <> 7 then
    raise exception 'SEED CHECK: AC-203 expected 7 critical-safety template lines, found %', v_ac203_safety;
  end if;

  -- The AC tier credential requires the three slice skill badges.
  select requires into v_tier_badge_requires from academy.badge_classes
    where key = 'tier.ac.certified_technician';
  if not (v_tier_badge_requires -> 'badges' ? 'skill.ac.single_door_aero'
      and v_tier_badge_requires -> 'badges' ? 'skill.ac.mercury_wiring'
      and v_tier_badge_requires -> 'badges' ? 'skill.ac.maglock_rex_egress') then
    raise exception 'SEED CHECK: AC tier credential requires[] missing a component skill badge';
  end if;

  -- THE DAG INVARIANT: the seeded prerequisite graph must be acyclic.
  if not academy.prereq_graph_is_dag() then
    raise exception 'SEED CHECK: course_prerequisites graph is NOT a DAG — a cycle was seeded!';
  end if;

  raise notice 'S1 MVP-slice seed OK: 14 courses / 14 versions / closure edges present / rubric templates seeded (AC-201=9, AC-202=8, AC-203=12 incl. 7 critical-safety) / AC tier credential stacked / prereq graph is a DAG.';
end $$;

commit;
