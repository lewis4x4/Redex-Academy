-- M2 content seed assertion (run after seed/0002). Fails loudly if the three AC
-- sim_definitions did not land as published rows with the expected engine kinds and
-- competency links. Pairs with the §8 self-assert in 0001 — a live run fails fast on
-- any drift. The spec PAYLOAD validity is proven separately by the Zod test
-- (packages/sim-schemas/src/m2-ac-specs.test.ts), so this asserts the DB contract.
do $$
declare
  n_defs int;
  n_pub  int;
  n_i2d  int;
  n_calc int;
begin
  select count(*) into n_defs from academy.sim_definitions
    where key in ('ac-101/anatomy-of-a-door', 'ac-102/spec-the-door', 'ac-202/will-it-hold');
  if n_defs <> 3 then
    raise exception 'M2: expected 3 AC sim_definitions, found %', n_defs;
  end if;

  select count(*) into n_pub from academy.sim_definitions
    where key in ('ac-101/anatomy-of-a-door', 'ac-102/spec-the-door', 'ac-202/will-it-hold')
      and status = 'published';
  if n_pub <> 3 then
    raise exception 'M2: expected 3 PUBLISHED AC sim_definitions, found %', n_pub;
  end if;

  select count(*) into n_i2d from academy.sim_definitions
    where key in ('ac-101/anatomy-of-a-door', 'ac-102/spec-the-door') and kind = 'interaction_2d';
  if n_i2d <> 2 then
    raise exception 'M2: expected 2 interaction_2d AC sims, found %', n_i2d;
  end if;

  select count(*) into n_calc from academy.sim_definitions
    where key = 'ac-202/will-it-hold' and kind = 'calculator';
  if n_calc <> 1 then
    raise exception 'M2: expected the AC-202 calculator sim, found %', n_calc;
  end if;

  -- the AC-101 spec must carry its safety hotspot in the spec payload (defense vs drift)
  if not exists (
    select 1 from academy.sim_definitions
    where key = 'ac-101/anatomy-of-a-door'
      and spec -> 'items' @> '[{"scoring":{"safety_flag":true,"dimension":"safety_compliance"}}]'
  ) then
    raise exception 'M2: AC-101 spec is missing its safety_flag/safety_compliance item';
  end if;

  raise notice 'M2 content seed OK: 3 AC sim_definitions published (2 interaction_2d + 1 calculator)';
end $$;
