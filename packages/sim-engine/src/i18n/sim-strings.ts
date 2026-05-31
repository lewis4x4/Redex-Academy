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
    'You trapped the occupants. On an egress door a mag lock must release every way out: on loss of power, on the manual push-to-exit, and on a fire-alarm signal (NFPA 101 §7.2.1.6.2).',

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

  // 4. fire-alarm interface
  'sim.ac203.egress-fail.node.firealarm.prompt':
    'Last interface: how does this lock respond when the fire alarm goes off?',
  'sim.ac203.egress-fail.choice.facp.label':
    "Tie the lock's power to the fire-alarm panel (FACP) so it drops the instant the alarm sounds",
  'sim.ac203.egress-fail.choice.facp.consequence':
    'Correct. The lock must release automatically on a fire-alarm signal — the third required release mode.',
  'sim.ac203.egress-fail.choice.nofacp.label':
    'Leave the lock independent of the fire panel; the push-to-exit covers escape',
  'sim.ac203.egress-fail.choice.nofacp.consequence':
    "On a fire alarm the door stays locked and occupants can't flee a smoke-filled space. The lock must drop on alarm.",

  // 5. close-out (documentation / verification — NON-critical: a miss fails the
  //    job on score, but it is NOT a life-safety trap, so it never vetoes).
  'sim.ac203.egress-fail.node.closeout.prompt':
    'The lock is wired and behaving. Before you leave the site, what do you do?',
  'sim.ac203.egress-fail.choice.document.label':
    'Test all three release modes live, log them, and confirm AHJ approval on the as-built',
  'sim.ac203.egress-fail.choice.document.consequence':
    "Correct. An untested, undocumented egress install can't be proven compliant — verify the three release modes and record AHJ sign-off.",
  'sim.ac203.egress-fail.choice.packup.label': 'It works — pack up and head to the next job',
  'sim.ac203.egress-fail.choice.packup.consequence':
    "It may work today, but with nothing tested or logged there's no proof the egress is compliant and no AHJ record. (This isn't a life-safety trap, but the job isn't done.)",

  // terminals
  'sim.ac203.egress-fail.terminal.pass.text':
    'Everyone evacuated. The lock releases on loss of power, on the push-to-exit, and on the fire alarm — all three release modes verified and documented.',
  'sim.ac203.egress-fail.terminal.trapped_lock.text':
    'The power failed and the door stayed locked. Occupants were trapped behind a fail-locked egress door.',
  'sim.ac203.egress-fail.terminal.trapped_motion.text':
    'Someone the sensor never saw reached the door and found no way out. A motion REX is not a release.',
  'sim.ac203.egress-fail.terminal.trapped_placement.text':
    'In the dark and smoke, no one could find or reach the release. A button out of reach is no release.',
  'sim.ac203.egress-fail.terminal.trapped_fire.text':
    'The fire alarm sounded and the lock held. Occupants were trapped in a fire because the lock never dropped on alarm.',
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
    'You left the lock off the fire panel. NFPA 101 §7.2.1.6.2: the lock must release on fire-alarm activation.',

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
    'Atrapaste a los ocupantes. En una puerta de salida, una cerradura magnética debe liberar todas las vías de salida: al perder energía, con el push-to-exit manual y ante una señal de alarma de incendio (NFPA 101 §7.2.1.6.2).',

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
    'Última interfaz: ¿cómo responde esta cerradura cuando suena la alarma de incendio?',
  'sim.ac203.egress-fail.choice.facp.label':
    'Conecta la energía de la cerradura al panel de alarma de incendio (FACP) para que caiga apenas suene la alarma',
  'sim.ac203.egress-fail.choice.facp.consequence':
    'Correcto. La cerradura debe liberarse automáticamente ante una señal de alarma de incendio — el tercer modo de liberación obligatorio.',
  'sim.ac203.egress-fail.choice.nofacp.label':
    'Deja la cerradura independiente del panel de incendio; el push-to-exit cubre la salida',
  'sim.ac203.egress-fail.choice.nofacp.consequence':
    'Ante una alarma de incendio la puerta sigue cerrada y los ocupantes no pueden huir de un espacio lleno de humo. La cerradura debe caer ante la alarma.',

  'sim.ac203.egress-fail.node.closeout.prompt':
    'La cerradura está cableada y funcionando. Antes de irte del sitio, ¿qué haces?',
  'sim.ac203.egress-fail.choice.document.label':
    'Prueba en vivo los tres modos de liberación, regístralos y confirma la aprobación del AHJ en el as-built',
  'sim.ac203.egress-fail.choice.document.consequence':
    'Correcto. Una instalación de egreso sin probar ni documentar no se puede demostrar conforme — verifica los tres modos de liberación y registra la aprobación del AHJ.',
  'sim.ac203.egress-fail.choice.packup.label': 'Funciona — recoge y vete al siguiente trabajo',
  'sim.ac203.egress-fail.choice.packup.consequence':
    'Quizá funcione hoy, pero sin nada probado ni registrado no hay prueba de que el egreso sea conforme ni registro del AHJ. (No es una trampa de seguridad, pero el trabajo no está terminado.)',

  'sim.ac203.egress-fail.terminal.pass.text':
    'Todos evacuaron. La cerradura se libera al perder energía, con el push-to-exit y ante la alarma de incendio — los tres modos de liberación verificados y documentados.',
  'sim.ac203.egress-fail.terminal.trapped_lock.text':
    'Falló la energía y la puerta siguió cerrada. Los ocupantes quedaron atrapados detrás de una puerta de salida fail-locked.',
  'sim.ac203.egress-fail.terminal.trapped_motion.text':
    'Alguien a quien el sensor nunca vio llegó a la puerta y no encontró salida. Un REX de movimiento no es una liberación.',
  'sim.ac203.egress-fail.terminal.trapped_placement.text':
    'En la oscuridad y el humo, nadie pudo encontrar ni alcanzar la liberación. Un botón fuera de alcance no es una liberación.',
  'sim.ac203.egress-fail.terminal.trapped_fire.text':
    'Sonó la alarma de incendio y la cerradura aguantó. Los ocupantes quedaron atrapados en un incendio porque la cerradura nunca cayó ante la alarma.',
  'sim.ac203.egress-fail.terminal.fail_docs.text':
    'La cerradura funciona, pero no se probó ni registró nada y el AHJ nunca firmó — no hay prueba de que este egreso sea conforme.',

  'sim.ac203.egress-fail.replay.faillocked.overlay':
    'Configuraste esta cerradura de salida como fail-locked. NFPA 101 §7.2.1.6.2: una cerradura magnética en una puerta de salida debe liberarse al perder energía.',
  'sim.ac203.egress-fail.replay.motiononly.overlay':
    'Dependiste solo del REX de movimiento. NFPA 101 §7.2.1.6.2: se requiere un push-to-exit manual incluso cuando hay un sensor.',
  'sim.ac203.egress-fail.replay.mount_high.overlay':
    'Montaste el push-to-exit fuera de alcance. NFPA 101 §7.2.1.6.2: la liberación manual debe estar a 40–48 in de altura y a menos de 5 ft de la puerta.',
  'sim.ac203.egress-fail.replay.nofacp.overlay':
    'Dejaste la cerradura fuera del panel de incendio. NFPA 101 §7.2.1.6.2: la cerradura debe liberarse ante la activación de la alarma de incendio.',

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
};

export const SIM_STRINGS: SimStringTable = { en, es };
