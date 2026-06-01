/**
 * i18n strings for the Redex sims (EN + ES).
 *
 * AC-203 (the M3 flagship branching egress-fail sim) carries real curriculum EN
 * copy. The locked safety GLOSSARY TERMS (fail-safe / fail-locked / REX / egress /
 * push-to-exit / AHJ …) are NOT redefined here — they resolve from @redex/i18n's
 * non-overridable glossary, and the prose below renders them verbatim (never
 * paraphrased, never blurred — SAFETY_GLOSSARY.md).
 *
 * ES below is a working translation: general prose is translated, but every locked
 * safety term + the NFPA 101 §7.2.1.6.2 citation is kept in its canonical form
 * (terms are NEVER machine-translated — SAFETY_GLOSSARY.md). Professional SME
 * review/sign-off of the ES safety wording is a §J RELEASE gate (not a merge gate);
 * see docs/m3-ac203/RELEASE_GATES.md.
 */
import type { SimStringTable } from './resolver';

const en: Record<string, string> = {
  // common state tokens
  'sim.common.state.pass': 'Pass',
  'sim.common.state.fail': 'Fail',
  'sim.common.state.warn': 'Warning',
  'sim.common.state.neutral': '—',
  'sim.common.state.safety_stop': 'SAFETY STOP',

  // framework chrome (keyed so it resolves EN+ES — never a raw key on screen)
  'sim.common.action.retry': 'Back to the decision',
  'sim.common.action.submit': 'Submit configuration',

  // ── AC-203 branching: mag-lock egress (flagship, M3) ───────────────────────
  'sim.ac203.egress-fail.title': 'AC-203 — Mag-lock egress on a storefront door',
  'sim.ac203.egress-fail.veto':
    'You trapped the occupants. On an egress door a mag lock must let people out both ways: the instant building power is lost, and the moment someone hits the manual push-to-exit — which must hold the door released for the full ≥30 seconds (NFPA 101 §7.2.1.6.2).',

  // 1. fail-state
  'sim.ac203.egress-fail.node.failstate.prompt':
    "A storefront wants this glass egress door held by a 1,200 lb mag lock during business hours. You're commissioning it. How must the lock behave when building power is lost?",
  'sim.ac203.egress-fail.choice.failsafe.label':
    'Fail-safe — the lock releases (unlocks) on loss of power',
  'sim.ac203.egress-fail.choice.failsafe.consequence':
    'Correct. On an egress path the lock must be fail-safe, so a power failure can never trap occupants.',
  'sim.ac203.egress-fail.choice.faillocked.label':
    "Fail-locked — the lock stays locked on loss of power (the customer wants it 'secure')",
  'sim.ac203.egress-fail.choice.faillocked.consequence':
    'A power failure now traps everyone behind a locked egress door. Free egress is not the customer’s to waive.',

  // 2. request-to-exit / manual release present
  'sim.ac203.egress-fail.node.rex.prompt':
    'A motion REX (request-to-exit) sensor is mounted above the door. Is sensing approach enough to release this mag lock for someone leaving?',
  'sim.ac203.egress-fail.choice.pushtoexit.label':
    'No — add a manual push-to-exit that drops the lock for at least 30 seconds, independent of the access system',
  'sim.ac203.egress-fail.choice.pushtoexit.consequence':
    'Correct. A motion REX alone is not a code release; the manual push-to-exit is required even when a sensor is present (NFPA 101 §7.2.1.6.2).',
  'sim.ac203.egress-fail.choice.motiononly.label':
    'Yes — the motion REX releases the lock, so no manual button is needed',
  'sim.ac203.egress-fail.choice.motiononly.consequence':
    'A person the sensor misses — or a sensor that fails — has no way out. A motion REX never replaces the manual push-to-exit.',

  // 3. push-to-exit placement
  'sim.ac203.egress-fail.node.placement.prompt':
    "You're mounting the push-to-exit button. Where does it go?",
  'sim.ac203.egress-fail.choice.mount_reachable.label':
    '40–48 in above the floor, within 5 ft of the door, clearly signed',
  'sim.ac203.egress-fail.choice.mount_reachable.consequence':
    'Correct. The release must be reachable by anyone fleeing — 40–48 in high, within 5 ft of the door, and signed.',
  'sim.ac203.egress-fail.choice.mount_high.label':
    "High on the wall by the panel, out of casual reach so it isn't pressed by accident",
  'sim.ac203.egress-fail.choice.mount_high.consequence':
    'A release no one can reach in the dark is no release. Out of reach or beyond 5 ft fails the egress rubric.',

  // 4. release time — the emergency climax: when the push-to-exit is hit, how long
  //    must the lock stay released? (Re-centered off the former fire-alarm interface
  //    onto the power-loss + push-to-exit release the course teaches; the fire-alarm
  //    interface is a specialist job and is escalated, not wired on this install.)
  'sim.ac203.egress-fail.node.firealarm.prompt':
    'The emergency hits and people rush the door. When someone hits the manual push-to-exit, how long must the lock stay released?',
  'sim.ac203.egress-fail.choice.facp.label':
    'Hold the release for the full ≥30 seconds, so a crowd has time to clear the opening',
  'sim.ac203.egress-fail.choice.facp.consequence':
    'Correct. The manual push-to-exit must drop the lock and hold it released for at least 30 seconds — long enough for everyone to get through (NFPA 101 §7.2.1.6.2).',
  'sim.ac203.egress-fail.choice.nofacp.label':
    'A momentary release — the lock drops, then re-engages a second later when the button is released',
  'sim.ac203.egress-fail.choice.nofacp.consequence':
    'A momentary release re-locks while people are still at the door, trapping whoever has not gotten through. The release must hold for the full 30 seconds.',

  // 5. close-out (documentation / verification — NON-critical: a miss fails the
  //    job on score, but it is NOT a life-safety trap, so it never vetoes).
  'sim.ac203.egress-fail.node.closeout.prompt':
    'The lock is wired and behaving. Before you leave the site, what do you do?',
  'sim.ac203.egress-fail.choice.document.label':
    'Test both release modes live, prove the armature seal with the pull test, log it all, and confirm AHJ approval on the as-built',
  'sim.ac203.egress-fail.choice.document.consequence':
    "Correct. An untested, undocumented egress install can't be proven compliant — verify both release modes, prove the seal with the pull test, and record AHJ sign-off.",
  'sim.ac203.egress-fail.choice.packup.label': 'It works — pack up and head to the next job',
  'sim.ac203.egress-fail.choice.packup.consequence':
    "It may work today, but with nothing tested or logged there's no proof the egress is compliant and no AHJ record. (This isn't a life-safety trap, but the job isn't done.)",

  // terminals
  'sim.ac203.egress-fail.terminal.pass.text':
    'Everyone evacuated. The lock releases on loss of power, and the manual push-to-exit drops it and holds it open for the full 30 seconds — both release modes verified, the armature seal pull-tested, and the job documented.',
  'sim.ac203.egress-fail.terminal.trapped_lock.text':
    'The power failed and the door stayed locked. Occupants were trapped behind a fail-locked egress door.',
  'sim.ac203.egress-fail.terminal.trapped_motion.text':
    'Someone the sensor never saw reached the door and found no way out. A motion REX is not a release.',
  'sim.ac203.egress-fail.terminal.trapped_placement.text':
    'In the dark and smoke, no one could find or reach the release. A button out of reach is no release.',
  'sim.ac203.egress-fail.terminal.trapped_fire.text':
    'The push-to-exit gave only a momentary release and the lock re-engaged while people were still at the door. Occupants were trapped because the release never held long enough for the crowd to get out.',
  'sim.ac203.egress-fail.terminal.fail_docs.text':
    "The lock works, but nothing was tested or logged and the AHJ never signed off — there's no proof this egress is compliant.",

  // post-mortem replay overlays: the deciding choice + the governing code line
  'sim.ac203.egress-fail.replay.faillocked.overlay':
    'You set this egress lock fail-locked. NFPA 101 §7.2.1.6.2: a mag lock on an egress door must release on loss of power.',
  'sim.ac203.egress-fail.replay.motiononly.overlay':
    'You relied on the motion REX alone. NFPA 101 §7.2.1.6.2: a manual push-to-exit is required even when a sensor is present.',
  'sim.ac203.egress-fail.replay.mount_high.overlay':
    'You mounted the push-to-exit out of reach. NFPA 101 §7.2.1.6.2: the manual release must be 40–48 in high and within 5 ft of the door.',
  'sim.ac203.egress-fail.replay.nofacp.overlay':
    'You set the push-to-exit to a momentary release. NFPA 101 §7.2.1.6.2: the manual release must hold the lock released for at least 30 seconds.',

  'sim.ac203.media.storefront.alt':
    'A glass storefront door secured by a 1,200 lb magnetic lock, with a card reader and a push-to-exit button.',
  'sim.ac203.media.crowd_trapped.alt':
    'People crowded against a locked glass door, unable to push it open to get out.',

  // ── AC-201 device-config: Aero single-door commission ──────────────────────
  'sim.ac201.aero.title': 'AC-201 — Commission a single door on an ADC Aero controller',
  'sim.ac201.aero.veto':
    'This wiring would trap occupants: the egress lock must be fail-safe so it releases on power loss.',
  'sim.ac201.aero.screen.wiring': 'Door wiring',
  'sim.ac201.aero.screen.relay': 'Relay logic',
  'sim.ac201.aero.screen.portal': 'Partner Portal',
  'sim.ac201.aero.field.lock_output_mode': 'Lock output mode',
  'sim.ac201.aero.field.rex_input': 'REX input terminal',
  'sim.ac201.aero.field.dps_input': 'DPS input terminal',
  'sim.ac201.aero.field.lock_polarity': 'Lock polarity',
  'sim.ac201.aero.field.relay_logic': 'Relay logic',
  'sim.ac201.aero.field.cloud_added': 'Door added & verified in Partner Portal',
  'sim.ac201.aero.opt.failsafe': 'Fail-safe',
  'sim.ac201.aero.opt.faillocked': 'Fail-locked',
  'sim.ac201.aero.opt.rex_terminal': 'REX terminal',
  'sim.ac201.aero.opt.dps_terminal': 'DPS terminal',
  'sim.ac201.aero.opt.normal': 'Normal',
  'sim.ac201.aero.opt.reversed': 'Reversed',
  'sim.ac201.aero.rule.failsafe.desc': 'The egress lock output must be set fail-safe.',
  'sim.ac201.aero.rule.failsafe.feedback':
    'Set the lock output to fail-safe — an egress lock must release on power loss.',
  'sim.ac201.aero.rule.rexdps.desc': 'REX and DPS must land on their own terminals (not swapped).',
  'sim.ac201.aero.rule.rexdps.feedback':
    'Swap them back: REX on the REX terminal, DPS on the DPS terminal.',
  'sim.ac201.aero.rule.relay.desc':
    'The relay must switch the lock circuit, not power the lock through it.',
  'sim.ac201.aero.rule.relay.feedback':
    'Wire the relay to switch the lock circuit with normal polarity.',
  'sim.ac201.aero.rule.cloud.desc': 'The door must be added and verified in the Partner Portal.',
  'sim.ac201.aero.rule.cloud.feedback':
    'Add the door in the Partner Portal and confirm it reports.',

  // ── AC-203 new sims (the flagship): mag-vs-strike, armature, button, follow-power, virtual door ──
  // mag-vs-strike-pick (Unit 1 — two locks, opposite power rules)
  'sim.ac203.mag-vs-strike.title': 'AC-203 — Two locks, opposite rules: mag vs. electric strike',
  'sim.ac203.mag-vs-strike.veto':
    'On an egress door, free egress is non-negotiable — you may never stop someone getting out.',
  'sim.ac203.mag-vs-strike.bg.alt':
    'A door with a magnetic lock on one option and an electric strike on the other.',
  'sim.ac203.mag-vs-strike.power.prompt': 'Match each lock to what power does to it.',
  'sim.ac203.mag-vs-strike.power.feedback':
    'A mag lock is powered to LOCK (fail-safe, wired normally closed) — cut power and it releases. An electric strike is powered to UNLOCK (fail-secure, normally open). This course is the mag: the one that holds the door with electricity, which is exactly why getting the release wrong can trap people.',
  'sim.ac203.mag-vs-strike.dev.maglock': 'Magnetic lock (1200S)',
  'sim.ac203.mag-vs-strike.dev.strike': 'Electric strike',
  'sim.ac203.mag-vs-strike.rule.powered_lock':
    'Powered to LOCK — releases on loss of power (fail-safe, normally closed)',
  'sim.ac203.mag-vs-strike.rule.powered_unlock':
    'Powered to UNLOCK — stays locked on loss of power (fail-secure, normally open)',

  // armature-mount (Unit 2 — the seal that makes the hold real)
  'sim.ac203.armature.title': 'AC-203 — Seat the armature: the seal that makes the hold real',
  'sim.ac203.armature.veto':
    'A half-seated armature reads locked but holds a fraction of its rating and the door pulls open — with nothing on the panel to warn you. Seat it to a full seal.',
  'sim.ac203.armature.bg.alt':
    'Three ways to mount the armature plate: under-seated and loose, floating on rubber washers, and torqued down solid.',
  'sim.ac203.armature.seat.prompt':
    'Mount the 1,200 lb armature so it seats dead flush against the magnet face. Which mounting holds full rating?',
  'sim.ac203.armature.seat.feedback':
    'Loctite the bolt so it never vibrates loose, but never torque it solid — use the rubber washers from the kit so the plate can rock and self-align to a 100% seal. Over-tight or loose both give a weak hold the panel never warns you about.',
  'sim.ac203.armature.region.loose':
    'Loose — too few washers / under-torqued, the plate rattles and never seats',
  'sim.ac203.armature.region.sealed':
    'Loctited but floating on the rubber washers — the plate rocks to a flush, full-rating seal',
  'sim.ac203.armature.region.solid':
    'Torqued down solid — rigid, cannot self-align, half-seals at a fraction of rating',

  // button-placement (Unit 3 — where the push-to-exit goes + how long it holds)
  'sim.ac203.button.title': 'AC-203 — Place the push-to-exit and set its release',
  'sim.ac203.button.veto':
    'A release no one can reach, or one that re-locks in a second, is no release. Mount it in the egress envelope and hold it for the full 30 seconds.',
  'sim.ac203.button.bg.alt':
    'A door elevation showing zones for the push-to-exit button: too high, the reachable envelope, and too far from the door.',
  'sim.ac203.button.place.prompt': 'Place the TS9 push-to-exit. Where does it go?',
  'sim.ac203.button.place.feedback':
    'The manual release must be reachable by anyone fleeing: 40–48 in above the floor, within 5 ft of the door, and signed (NFPA 101 §7.2.1.6.2).',
  'sim.ac203.button.region.too_high': 'High on the wall, above 48 in — out of reach in the dark',
  'sim.ac203.button.region.envelope': '40–48 in above the floor, within 5 ft of the door',
  'sim.ac203.button.region.too_far': 'More than 5 ft from the door',
  'sim.ac203.button.time.prompt': 'How long must the push-to-exit hold the lock released?',
  'sim.ac203.button.time.feedback':
    'The release must hold for at least 30 seconds so a crowd can clear the opening; a momentary release re-locks and traps people (NFPA 101 §7.2.1.6.2).',
  'sim.ac203.button.time.setting': 'Push-to-exit release hold time',
  'sim.ac203.button.time.full_30s': 'At least 30 seconds',
  'sim.ac203.button.time.momentary': 'Momentary — releases only while held',

  // follow-the-power (Unit 4 — troubleshoot the dead mag)
  'sim.ac203.follow-power.title': 'AC-203 — Follow the power: find the dead mag',
  'sim.ac203.follow-power.veto':
    'Free egress is non-negotiable — never leave an egress door that cannot release.',
  'sim.ac203.follow-power.bg.alt':
    'A mag-lock power run with meter test points: the 24V supply, the controller, the push-to-exit button, the wire run, and the lock.',
  'sim.ac203.follow-power.trace.prompt':
    "Dead mag. You meter 24V at the supply and 24V through the controller, but 0V at the lock end. Don't guess — where is the fault?",
  'sim.ac203.follow-power.trace.feedback':
    'Follow the power in order with a meter. Most "dead mag" calls trace back to the push-button wiring, not the mag — it sits in-line in the mag power, so a bad button connection kills the lock. A brand-new mag being bad is about one in a million: chase the wire first.',
  'sim.ac203.follow-power.region.supply': 'The 24V supply',
  'sim.ac203.follow-power.region.controller': 'The Alarm.com controller (passing 24V when locked)',
  'sim.ac203.follow-power.region.run': 'The wire run to the lock',
  'sim.ac203.follow-power.region.button':
    'The push-to-exit button wiring (in-line in the mag power)',
  'sim.ac203.follow-power.region.mag': 'The mag lock itself',

  // virtual-door-maglock (Unit 6 — build it and prove both release paths)
  'sim.ac203.vdoor.title': 'AC-203 — Virtual door: build the mag + REX + push-to-exit',
  'sim.ac203.vdoor.veto':
    'This build would trap occupants. The lock must drop on loss of power and the push-to-exit must cut its power directly.',
  'sim.ac203.vdoor.screen.wiring': 'Wire the lock, REX and push-to-exit',
  'sim.ac203.vdoor.screen.prove': 'Prove both release paths',
  'sim.ac203.vdoor.field.mag_black': 'Lock Black lead lands on…',
  'sim.ac203.vdoor.field.mag_red': 'Lock Red lead lands on…',
  'sim.ac203.vdoor.field.rex_input': 'The REX (Bosch DS160) lands on…',
  'sim.ac203.vdoor.field.push_to_exit_wiring': 'The push-to-exit (TS9) is wired…',
  'sim.ac203.vdoor.field.prove_power_loss':
    'Proved the lock releases on loss of power AND on the push-to-exit',
  'sim.ac203.vdoor.opt.v24_supply': '24V on the power supply',
  'sim.ac203.vdoor.opt.controller_nc': 'NC on the Alarm.com controller',
  'sim.ac203.vdoor.opt.ground': 'Ground',
  'sim.ac203.vdoor.opt.controller_input':
    'A controller Input (it signals the controller to release)',
  'sim.ac203.vdoor.opt.mag_power_inline': "In-line in the mag's power",
  'sim.ac203.vdoor.opt.inline_mag_power':
    "In-line in the mag's power, so pressing it cuts the lock's power directly",
  'sim.ac203.vdoor.opt.controller_input_only': 'Only to a controller Input, like the REX',
  'sim.ac203.vdoor.rule.failsafe.desc':
    'The lock is wired fail-safe: Black to the 24V supply, Red to the controller NC.',
  'sim.ac203.vdoor.rule.failsafe.feedback':
    'Wire it fail-safe: Black to the 24V supply, Red to the controller NC, so losing the supply drops the mag.',
  'sim.ac203.vdoor.rule.rex.desc': 'The REX lands on a controller Input, not in the mag power.',
  'sim.ac203.vdoor.rule.rex.feedback':
    'Land the REX on a controller Input — it signals the controller; it does not cut mag power.',
  'sim.ac203.vdoor.rule.pte.desc': "The push-to-exit is wired in-line in the mag's power.",
  'sim.ac203.vdoor.rule.pte.feedback':
    "Wire the push-to-exit in-line in the mag's power so pressing it cuts power to the lock directly — a motion REX alone is not a compliant release.",
  'sim.ac203.vdoor.rule.proveloss.desc':
    'Both release paths are proven live: loss of power and the push-to-exit.',
  'sim.ac203.vdoor.rule.proveloss.feedback':
    'Prove both release paths before you call it done: kill the supply (the mag drops) and press the push-to-exit (it cuts power directly).',
};

const es: Record<string, string> = {
  'sim.common.state.pass': 'Aprobado',
  'sim.common.state.fail': 'Reprobado',
  'sim.common.state.warn': 'Advertencia',
  'sim.common.state.neutral': '—',
  'sim.common.state.safety_stop': 'PARADA DE SEGURIDAD',

  'sim.common.action.retry': 'Volver a la decisión',
  'sim.common.action.submit': 'Enviar configuración',

  // ── AC-203 (ES prose; locked safety terms + la cita NFPA 101 §7.2.1.6.2 se
  //    mantienen en su forma canónica — revisión SME es una compuerta de release) ──
  'sim.ac203.egress-fail.title': 'AC-203 — Salida con cerradura magnética en puerta de tienda',
  'sim.ac203.egress-fail.veto':
    'Atrapaste a los ocupantes. En una puerta de salida, una cerradura magnética debe dejar salir a la gente por ambas vías: al instante de perder energía y en el momento en que alguien presiona el push-to-exit manual — que debe mantener la puerta liberada los ≥30 segundos completos (NFPA 101 §7.2.1.6.2).',

  'sim.ac203.egress-fail.node.failstate.prompt':
    'Una tienda quiere que esta puerta de salida de vidrio quede sujeta por una cerradura magnética de 1,200 lb durante el horario comercial. La estás poniendo en servicio. ¿Cómo debe comportarse la cerradura al perder energía el edificio?',
  'sim.ac203.egress-fail.choice.failsafe.label':
    'Fail-safe — la cerradura se libera (abre) al perder energía',
  'sim.ac203.egress-fail.choice.failsafe.consequence':
    'Correcto. En una ruta de salida la cerradura debe ser fail-safe, para que un corte de energía nunca atrape a los ocupantes.',
  'sim.ac203.egress-fail.choice.faillocked.label':
    'Fail-locked — la cerradura permanece cerrada al perder energía (el cliente la quiere «segura»)',
  'sim.ac203.egress-fail.choice.faillocked.consequence':
    'Ahora un corte de energía atrapa a todos detrás de una puerta de salida cerrada. El free egress no es algo que el cliente pueda renunciar.',

  'sim.ac203.egress-fail.node.rex.prompt':
    'Hay un sensor de movimiento REX (request-to-exit) montado sobre la puerta. ¿Basta con detectar la aproximación para liberar esta cerradura magnética a quien sale?',
  'sim.ac203.egress-fail.choice.pushtoexit.label':
    'No — agrega un push-to-exit manual que corte la cerradura por al menos 30 segundos, independiente del sistema de acceso',
  'sim.ac203.egress-fail.choice.pushtoexit.consequence':
    'Correcto. Un REX de movimiento por sí solo no es una liberación normada; el push-to-exit manual es obligatorio incluso cuando hay un sensor (NFPA 101 §7.2.1.6.2).',
  'sim.ac203.egress-fail.choice.motiononly.label':
    'Sí — el REX de movimiento libera la cerradura, así que no hace falta un botón manual',
  'sim.ac203.egress-fail.choice.motiononly.consequence':
    'Una persona que el sensor no detecta —o un sensor que falla— se queda sin salida. Un REX de movimiento nunca reemplaza al push-to-exit manual.',

  'sim.ac203.egress-fail.node.placement.prompt': 'Vas a montar el botón push-to-exit. ¿Dónde va?',
  'sim.ac203.egress-fail.choice.mount_reachable.label':
    'A 40–48 in del piso, a menos de 5 ft de la puerta, con señalización clara',
  'sim.ac203.egress-fail.choice.mount_reachable.consequence':
    'Correcto. La liberación debe estar al alcance de cualquiera que huya — a 40–48 in de altura, a menos de 5 ft de la puerta y señalizada.',
  'sim.ac203.egress-fail.choice.mount_high.label':
    'Alto en la pared junto al panel, fuera de alcance común para que no se presione por accidente',
  'sim.ac203.egress-fail.choice.mount_high.consequence':
    'Una liberación que nadie alcanza en la oscuridad no es una liberación. Fuera de alcance o a más de 5 ft reprueba la rúbrica de egreso.',

  'sim.ac203.egress-fail.node.firealarm.prompt':
    'Llega la emergencia y la gente corre hacia la puerta. Cuando alguien presiona el push-to-exit manual, ¿cuánto tiempo debe permanecer liberada la cerradura?',
  'sim.ac203.egress-fail.choice.facp.label':
    'Mantén la liberación durante los ≥30 segundos completos, para que una multitud tenga tiempo de cruzar la salida',
  'sim.ac203.egress-fail.choice.facp.consequence':
    'Correcto. El push-to-exit manual debe soltar la cerradura y mantenerla liberada al menos 30 segundos — suficiente para que todos puedan salir (NFPA 101 §7.2.1.6.2).',
  'sim.ac203.egress-fail.choice.nofacp.label':
    'Una liberación momentánea — la cerradura cae y se vuelve a enganchar un segundo después al soltar el botón',
  'sim.ac203.egress-fail.choice.nofacp.consequence':
    'Una liberación momentánea se vuelve a cerrar mientras la gente sigue en la puerta, atrapando a quien no ha salido. La liberación debe mantenerse los 30 segundos completos.',

  'sim.ac203.egress-fail.node.closeout.prompt':
    'La cerradura está cableada y funcionando. Antes de irte del sitio, ¿qué haces?',
  'sim.ac203.egress-fail.choice.document.label':
    'Prueba en vivo ambos modos de liberación, comprueba el sello de la armadura con la prueba de tracción, regístralo todo y confirma la aprobación del AHJ en el as-built',
  'sim.ac203.egress-fail.choice.document.consequence':
    'Correcto. Una instalación de egreso sin probar ni documentar no se puede demostrar conforme — verifica ambos modos de liberación, comprueba el sello con la prueba de tracción y registra la aprobación del AHJ.',
  'sim.ac203.egress-fail.choice.packup.label': 'Funciona — recoge y vete al siguiente trabajo',
  'sim.ac203.egress-fail.choice.packup.consequence':
    'Quizá funcione hoy, pero sin nada probado ni registrado no hay prueba de que el egreso sea conforme ni registro del AHJ. (No es una trampa de seguridad, pero el trabajo no está terminado.)',

  'sim.ac203.egress-fail.terminal.pass.text':
    'Todos evacuaron. La cerradura se libera al perder energía, y el push-to-exit manual la suelta y la mantiene abierta los 30 segundos completos — ambos modos de liberación verificados, el sello de la armadura comprobado con la prueba de tracción y el trabajo documentado.',
  'sim.ac203.egress-fail.terminal.trapped_lock.text':
    'Falló la energía y la puerta siguió cerrada. Los ocupantes quedaron atrapados detrás de una puerta de salida fail-locked.',
  'sim.ac203.egress-fail.terminal.trapped_motion.text':
    'Alguien a quien el sensor nunca vio llegó a la puerta y no encontró salida. Un REX de movimiento no es una liberación.',
  'sim.ac203.egress-fail.terminal.trapped_placement.text':
    'En la oscuridad y el humo, nadie pudo encontrar ni alcanzar la liberación. Un botón fuera de alcance no es una liberación.',
  'sim.ac203.egress-fail.terminal.trapped_fire.text':
    'El push-to-exit dio solo una liberación momentánea y la cerradura se volvió a enganchar mientras la gente seguía en la puerta. Los ocupantes quedaron atrapados porque la liberación nunca se mantuvo lo suficiente para que la multitud saliera.',
  'sim.ac203.egress-fail.terminal.fail_docs.text':
    'La cerradura funciona, pero no se probó ni registró nada y el AHJ nunca firmó — no hay prueba de que este egreso sea conforme.',

  'sim.ac203.egress-fail.replay.faillocked.overlay':
    'Configuraste esta cerradura de salida como fail-locked. NFPA 101 §7.2.1.6.2: una cerradura magnética en una puerta de salida debe liberarse al perder energía.',
  'sim.ac203.egress-fail.replay.motiononly.overlay':
    'Dependiste solo del REX de movimiento. NFPA 101 §7.2.1.6.2: se requiere un push-to-exit manual incluso cuando hay un sensor.',
  'sim.ac203.egress-fail.replay.mount_high.overlay':
    'Montaste el push-to-exit fuera de alcance. NFPA 101 §7.2.1.6.2: la liberación manual debe estar a 40–48 in de altura y a menos de 5 ft de la puerta.',
  'sim.ac203.egress-fail.replay.nofacp.overlay':
    'Configuraste el push-to-exit con una liberación momentánea. NFPA 101 §7.2.1.6.2: la liberación manual debe mantener la cerradura liberada al menos 30 segundos.',

  'sim.ac203.media.storefront.alt':
    'Una puerta de vidrio de tienda asegurada por una cerradura magnética de 1,200 lb, con lector de tarjeta y un botón push-to-exit.',
  'sim.ac203.media.crowd_trapped.alt':
    'Personas agolpadas contra una puerta de vidrio cerrada, sin poder empujarla para salir.',

  'sim.ac201.aero.title': 'AC-201 — Poner en servicio una puerta en un controlador ADC Aero',
  'sim.ac201.aero.veto':
    'Este cableado atraparía a los ocupantes: la cerradura de salida debe ser fail-safe para liberarse al perder energía.',
  'sim.ac201.aero.screen.wiring': 'Cableado de puerta',
  'sim.ac201.aero.screen.relay': 'Lógica de relé',
  'sim.ac201.aero.screen.portal': 'Portal de Socios',
  'sim.ac201.aero.field.lock_output_mode': 'Modo de salida de cerradura',
  'sim.ac201.aero.field.rex_input': 'Terminal de entrada REX',
  'sim.ac201.aero.field.dps_input': 'Terminal de entrada DPS',
  'sim.ac201.aero.field.lock_polarity': 'Polaridad de cerradura',
  'sim.ac201.aero.field.relay_logic': 'Lógica de relé',
  'sim.ac201.aero.field.cloud_added': 'Puerta agregada y verificada en el Portal de Socios',
  'sim.ac201.aero.opt.failsafe': 'Fail-safe',
  'sim.ac201.aero.opt.faillocked': 'Fail-locked',
  'sim.ac201.aero.opt.rex_terminal': 'Terminal REX',
  'sim.ac201.aero.opt.dps_terminal': 'Terminal DPS',
  'sim.ac201.aero.opt.normal': 'Normal',
  'sim.ac201.aero.opt.reversed': 'Invertida',
  'sim.ac201.aero.rule.failsafe.desc':
    'La salida de la cerradura de egreso debe configurarse como fail-safe.',
  'sim.ac201.aero.rule.failsafe.feedback':
    'Configura la salida de la cerradura como fail-safe — una cerradura de egreso debe liberarse al perder energía.',
  'sim.ac201.aero.rule.rexdps.desc':
    'REX y DPS deben ir en sus propias terminales (no intercambiadas).',
  'sim.ac201.aero.rule.rexdps.feedback':
    'Vuelve a colocarlas: REX en la terminal REX, DPS en la terminal DPS.',
  'sim.ac201.aero.rule.relay.desc':
    'El relé debe conmutar el circuito de la cerradura, no alimentarla a través de él.',
  'sim.ac201.aero.rule.relay.feedback':
    'Cablea el relé para conmutar el circuito de la cerradura con polaridad normal.',
  'sim.ac201.aero.rule.cloud.desc':
    'La puerta debe agregarse y verificarse en el Portal de Socios.',
  'sim.ac201.aero.rule.cloud.feedback':
    'Agrega la puerta en el Portal de Socios y confirma que reporta.',

  // ── AC-203 nuevos sims (ES de trabajo; términos de seguridad bloqueados + la cita
  //    NFPA 101 §7.2.1.6.2 en forma canónica — revisión SME es compuerta de release) ──
  'sim.ac203.mag-vs-strike.title':
    'AC-203 — Dos cerraduras, reglas opuestas: magnética vs. electric strike',
  'sim.ac203.mag-vs-strike.veto':
    'En una puerta de salida, el free egress es innegociable — nunca puedes impedir que alguien salga.',
  'sim.ac203.mag-vs-strike.bg.alt':
    'Una puerta con una cerradura magnética en una opción y un electric strike en la otra.',
  'sim.ac203.mag-vs-strike.power.prompt': 'Empareja cada cerradura con lo que la energía le hace.',
  'sim.ac203.mag-vs-strike.power.feedback':
    'Una cerradura magnética está energizada para CERRAR (fail-safe, cableada normalmente cerrada) — corta la energía y se libera. Un electric strike está energizado para ABRIR (fail-secure, normalmente abierto). Este curso es la magnética: la que sujeta la puerta con electricidad, justo por eso equivocar la liberación puede atrapar a la gente.',
  'sim.ac203.mag-vs-strike.dev.maglock': 'Cerradura magnética (1200S)',
  'sim.ac203.mag-vs-strike.dev.strike': 'Electric strike',
  'sim.ac203.mag-vs-strike.rule.powered_lock':
    'Energizada para CERRAR — se libera al perder energía (fail-safe, normalmente cerrada)',
  'sim.ac203.mag-vs-strike.rule.powered_unlock':
    'Energizada para ABRIR — permanece cerrada al perder energía (fail-secure, normalmente abierto)',

  'sim.ac203.armature.title': 'AC-203 — Asienta la armadura: el sello que hace real la sujeción',
  'sim.ac203.armature.veto':
    'Una armadura medio asentada marca cerrado pero sujeta una fracción de su capacidad y la puerta se abre de un tirón — sin nada en el panel que te avise. Asiéntala a un sello completo.',
  'sim.ac203.armature.bg.alt':
    'Tres formas de montar la placa de armadura: floja y mal asentada, flotando sobre arandelas de goma, y apretada a tope.',
  'sim.ac203.armature.seat.prompt':
    'Monta la armadura de 1,200 lb para que asiente totalmente a ras contra la cara del imán. ¿Qué montaje sujeta la capacidad completa?',
  'sim.ac203.armature.seat.feedback':
    'Aplica Loctite al perno para que nunca se afloje con la vibración, pero nunca lo aprietes a tope — usa las arandelas de goma del kit para que la placa pueda bascular y autoalinearse a un sello del 100%. Demasiado apretado o flojo dan una sujeción débil que el panel nunca te avisa.',
  'sim.ac203.armature.region.loose':
    'Floja — pocas arandelas / poco torque, la placa baila y nunca asienta',
  'sim.ac203.armature.region.sealed':
    'Con Loctite pero flotando sobre las arandelas de goma — la placa bascula a un sello a ras de capacidad completa',
  'sim.ac203.armature.region.solid':
    'Apretada a tope — rígida, no puede autoalinearse, medio sella a una fracción de su capacidad',

  'sim.ac203.button.title': 'AC-203 — Coloca el push-to-exit y ajusta su liberación',
  'sim.ac203.button.veto':
    'Una liberación que nadie alcanza, o que se vuelve a cerrar en un segundo, no es una liberación. Móntala en el envelope de egreso y mantenla los 30 segundos completos.',
  'sim.ac203.button.bg.alt':
    'Un alzado de puerta con zonas para el botón push-to-exit: demasiado alto, el envelope alcanzable y demasiado lejos de la puerta.',
  'sim.ac203.button.place.prompt': 'Coloca el push-to-exit TS9. ¿Dónde va?',
  'sim.ac203.button.place.feedback':
    'La liberación manual debe estar al alcance de cualquiera que huya: a 40–48 in del piso, a menos de 5 ft de la puerta y señalizada (NFPA 101 §7.2.1.6.2).',
  'sim.ac203.button.region.too_high':
    'Alto en la pared, por encima de 48 in — fuera de alcance en la oscuridad',
  'sim.ac203.button.region.envelope': 'A 40–48 in del piso, a menos de 5 ft de la puerta',
  'sim.ac203.button.region.too_far': 'A más de 5 ft de la puerta',
  'sim.ac203.button.time.prompt': '¿Cuánto debe mantener liberada la cerradura el push-to-exit?',
  'sim.ac203.button.time.feedback':
    'La liberación debe mantenerse al menos 30 segundos para que una multitud pueda despejar la salida; una liberación momentánea se vuelve a cerrar y atrapa a la gente (NFPA 101 §7.2.1.6.2).',
  'sim.ac203.button.time.setting': 'Tiempo de liberación del push-to-exit',
  'sim.ac203.button.time.full_30s': 'Al menos 30 segundos',
  'sim.ac203.button.time.momentary': 'Momentánea — libera solo mientras se mantiene presionado',

  'sim.ac203.follow-power.title': 'AC-203 — Sigue la energía: encuentra la cerradura muerta',
  'sim.ac203.follow-power.veto':
    'El free egress es innegociable — nunca dejes una puerta de salida que no pueda liberarse.',
  'sim.ac203.follow-power.bg.alt':
    'Un recorrido de energía de la cerradura magnética con puntos de medición: la fuente de 24V, el controlador, el botón push-to-exit, el tramo de cable y la cerradura.',
  'sim.ac203.follow-power.trace.prompt':
    'Cerradura muerta. Mides 24V en la fuente y 24V a través del controlador, pero 0V en el extremo de la cerradura. No adivines — ¿dónde está la falla?',
  'sim.ac203.follow-power.trace.feedback':
    'Sigue la energía en orden con un medidor. La mayoría de las llamadas de «cerradura muerta» se rastrean al cableado del botón, no a la cerradura — va en línea en la energía del imán, así que una mala conexión del botón mata la cerradura. Que una cerradura nueva venga mala es una en un millón: persigue el cable primero.',
  'sim.ac203.follow-power.region.supply': 'La fuente de 24V',
  'sim.ac203.follow-power.region.controller':
    'El controlador Alarm.com (pasa 24V cuando está cerrada)',
  'sim.ac203.follow-power.region.run': 'El tramo de cable hacia la cerradura',
  'sim.ac203.follow-power.region.button':
    'El cableado del botón push-to-exit (en línea en la energía del imán)',
  'sim.ac203.follow-power.region.mag': 'La cerradura magnética en sí',

  'sim.ac203.vdoor.title': 'AC-203 — Puerta virtual: arma el imán + REX + push-to-exit',
  'sim.ac203.vdoor.veto':
    'Este armado atraparía a los ocupantes. La cerradura debe caer al perder energía y el push-to-exit debe cortar su energía directamente.',
  'sim.ac203.vdoor.screen.wiring': 'Cablea la cerradura, el REX y el push-to-exit',
  'sim.ac203.vdoor.screen.prove': 'Comprueba ambas vías de liberación',
  'sim.ac203.vdoor.field.mag_black': 'El conductor Negro de la cerradura va a…',
  'sim.ac203.vdoor.field.mag_red': 'El conductor Rojo de la cerradura va a…',
  'sim.ac203.vdoor.field.rex_input': 'El REX (Bosch DS160) va a…',
  'sim.ac203.vdoor.field.push_to_exit_wiring': 'El push-to-exit (TS9) se cablea…',
  'sim.ac203.vdoor.field.prove_power_loss':
    'Comprobé que la cerradura se libera al perder energía Y con el push-to-exit',
  'sim.ac203.vdoor.opt.v24_supply': '24V en la fuente de poder',
  'sim.ac203.vdoor.opt.controller_nc': 'NC en el controlador Alarm.com',
  'sim.ac203.vdoor.opt.ground': 'Tierra',
  'sim.ac203.vdoor.opt.controller_input':
    'Una entrada del controlador (le indica al controlador que libere)',
  'sim.ac203.vdoor.opt.mag_power_inline': 'En línea en la energía del imán',
  'sim.ac203.vdoor.opt.inline_mag_power':
    'En línea en la energía del imán, para que al presionarlo corte la energía de la cerradura directamente',
  'sim.ac203.vdoor.opt.controller_input_only': 'Solo a una entrada del controlador, como el REX',
  'sim.ac203.vdoor.rule.failsafe.desc':
    'La cerradura se cablea fail-safe: Negro a la fuente de 24V, Rojo al NC del controlador.',
  'sim.ac203.vdoor.rule.failsafe.feedback':
    'Cabléala fail-safe: Negro a la fuente de 24V, Rojo al NC del controlador, para que perder la fuente haga caer el imán.',
  'sim.ac203.vdoor.rule.rex.desc':
    'El REX va a una entrada del controlador, no a la energía del imán.',
  'sim.ac203.vdoor.rule.rex.feedback':
    'Conecta el REX a una entrada del controlador — le señala al controlador; no corta la energía del imán.',
  'sim.ac203.vdoor.rule.pte.desc': 'El push-to-exit se cablea en línea en la energía del imán.',
  'sim.ac203.vdoor.rule.pte.feedback':
    'Cablea el push-to-exit en línea en la energía del imán para que al presionarlo corte la energía de la cerradura directamente — un REX de movimiento por sí solo no es una liberación conforme.',
  'sim.ac203.vdoor.rule.proveloss.desc':
    'Ambas vías de liberación se comprueban en vivo: pérdida de energía y el push-to-exit.',
  'sim.ac203.vdoor.rule.proveloss.feedback':
    'Comprueba ambas vías de liberación antes de darlo por terminado: corta la fuente (el imán cae) y presiona el push-to-exit (corta la energía directamente).',
};

export const SIM_STRINGS: SimStringTable = { en, es };
