/**
 * Toy i18n strings for the F5 reference sims (EN + ES). F5 ships toy fixtures +
 * toy translations; real curriculum strings + SME-reviewed ES land in M3/M4/S1.
 * The five LOCKED safety glossary TERMS (fail-safe/fail-locked/REX/egress/
 * partition) are NOT defined here — they resolve from @redex/i18n's non-overridable
 * glossary. ES below is a TOY rendering pending SME review (see the human gate).
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

  // ── AC-203 branching: mag-lock egress ──────────────────────────────────────
  'sim.ac203.egress-fail.title': 'AC-203 — Mag-lock egress on a storefront door',
  'sim.ac203.egress-fail.veto':
    'You trapped the occupants. A mag lock on an egress door must release on power loss, on request-to-exit, and on fire alarm.',
  'sim.ac203.egress-fail.node.arrival.prompt':
    'You arrive at a glass storefront door held by a mag lock. Begin the egress review.',
  'sim.ac203.egress-fail.node.failstate.prompt':
    'How should this mag lock behave when building power is lost?',
  'sim.ac203.egress-fail.choice.failsafe.label': 'Fail-safe — releases (unlocks) on power loss',
  'sim.ac203.egress-fail.choice.failsafe.consequence':
    'Correct. On an egress path the lock must release on power loss so no one is trapped.',
  'sim.ac203.egress-fail.choice.faillocked.label': 'Fail-locked — stays locked on power loss',
  'sim.ac203.egress-fail.choice.faillocked.consequence':
    'A power failure now traps everyone behind a locked egress door.',
  'sim.ac203.egress-fail.node.rex.prompt': 'How do occupants request to exit at the door?',
  'sim.ac203.egress-fail.choice.pushtoexit.label':
    'Push-to-exit button that cuts the lock for 30 s',
  'sim.ac203.egress-fail.choice.pushtoexit.consequence':
    'Correct. A code-compliant push-to-exit drops the lock independently of any sensor.',
  'sim.ac203.egress-fail.choice.motiononly.label': 'Motion sensor only',
  'sim.ac203.egress-fail.choice.motiononly.consequence':
    'A motion sensor can miss a person or fail — there is no reliable manual release.',
  'sim.ac203.egress-fail.node.fire.prompt': 'How does the lock respond to a fire alarm?',
  'sim.ac203.egress-fail.choice.facp.label':
    'Tie the lock power to the fire alarm panel (FACP) release',
  'sim.ac203.egress-fail.choice.facp.consequence':
    'Correct. On alarm, the lock drops automatically.',
  'sim.ac203.egress-fail.choice.nofacp.label': 'Leave the lock independent of the fire panel',
  'sim.ac203.egress-fail.choice.nofacp.consequence':
    'On a fire alarm the door stays locked — occupants cannot escape.',
  'sim.ac203.egress-fail.terminal.pass.text':
    'Everyone evacuated. The lock releases on power loss, on request-to-exit, and on fire alarm.',
  'sim.ac203.egress-fail.terminal.trapped_lock.text':
    'Occupants were trapped behind a locked door when power failed.',
  'sim.ac203.egress-fail.terminal.trapped_motion.text':
    'A person was trapped — the motion sensor never released the lock.',
  'sim.ac203.egress-fail.terminal.trapped_fire.text':
    'Occupants were trapped during a fire — the lock never released on alarm.',
  'sim.ac203.egress-fail.replay.faillocked.overlay':
    'You chose fail-locked here. NFPA 101 §7.2.1.6.2: egress locks must release on power loss.',
  'sim.ac203.egress-fail.replay.motiononly.overlay':
    'You relied on motion only. A manual push-to-exit is required on the egress path.',
  'sim.ac203.egress-fail.replay.nofacp.overlay':
    'You left the lock off the fire panel. It must release on fire alarm.',
  'sim.ac203.media.storefront.alt': 'A glass storefront door secured by a magnetic lock.',
  'sim.ac203.media.crowd_trapped.alt':
    'People crowded against a locked glass door, unable to exit.',

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

  'sim.ac203.egress-fail.title': 'AC-203 — Salida con cerradura magnética en puerta de tienda',
  'sim.ac203.egress-fail.veto':
    'Atrapaste a los ocupantes. Una cerradura magnética en una puerta de salida debe liberarse al perder energía, al solicitar salida y ante una alarma de incendio.',
  'sim.ac203.egress-fail.node.arrival.prompt':
    'Llegas a una puerta de vidrio sujeta por una cerradura magnética. Comienza la revisión de salida.',
  'sim.ac203.egress-fail.node.failstate.prompt':
    '¿Cómo debe comportarse esta cerradura magnética al perder energía el edificio?',
  'sim.ac203.egress-fail.choice.failsafe.label': 'Fail-safe — se libera (abre) al perder energía',
  'sim.ac203.egress-fail.choice.failsafe.consequence':
    'Correcto. En una ruta de salida la cerradura debe liberarse al perder energía para no atrapar a nadie.',
  'sim.ac203.egress-fail.choice.faillocked.label':
    'Fail-locked — permanece cerrada al perder energía',
  'sim.ac203.egress-fail.choice.faillocked.consequence':
    'Ahora un corte de energía atrapa a todos detrás de una puerta de salida cerrada.',
  'sim.ac203.egress-fail.node.rex.prompt': '¿Cómo solicitan salir los ocupantes en la puerta?',
  'sim.ac203.egress-fail.choice.pushtoexit.label':
    'Botón de salida que corta la cerradura por 30 s',
  'sim.ac203.egress-fail.choice.pushtoexit.consequence':
    'Correcto. Un botón de salida conforme libera la cerradura sin depender de un sensor.',
  'sim.ac203.egress-fail.choice.motiononly.label': 'Solo sensor de movimiento',
  'sim.ac203.egress-fail.choice.motiononly.consequence':
    'Un sensor de movimiento puede no detectar a una persona o fallar — no hay liberación manual confiable.',
  'sim.ac203.egress-fail.node.fire.prompt': '¿Cómo responde la cerradura a una alarma de incendio?',
  'sim.ac203.egress-fail.choice.facp.label':
    'Conectar la energía de la cerradura a la liberación del panel de incendio (FACP)',
  'sim.ac203.egress-fail.choice.facp.consequence':
    'Correcto. Ante la alarma, la cerradura se libera automáticamente.',
  'sim.ac203.egress-fail.choice.nofacp.label':
    'Dejar la cerradura independiente del panel de incendio',
  'sim.ac203.egress-fail.choice.nofacp.consequence':
    'Ante una alarma de incendio la puerta sigue cerrada — los ocupantes no pueden escapar.',
  'sim.ac203.egress-fail.terminal.pass.text':
    'Todos evacuaron. La cerradura se libera al perder energía, al solicitar salida y ante alarma de incendio.',
  'sim.ac203.egress-fail.terminal.trapped_lock.text':
    'Los ocupantes quedaron atrapados detrás de una puerta cerrada al fallar la energía.',
  'sim.ac203.egress-fail.terminal.trapped_motion.text':
    'Una persona quedó atrapada — el sensor de movimiento nunca liberó la cerradura.',
  'sim.ac203.egress-fail.terminal.trapped_fire.text':
    'Los ocupantes quedaron atrapados durante un incendio — la cerradura nunca se liberó ante la alarma.',
  'sim.ac203.egress-fail.replay.faillocked.overlay':
    'Elegiste fail-locked aquí. NFPA 101 §7.2.1.6.2: las cerraduras de salida deben liberarse al perder energía.',
  'sim.ac203.egress-fail.replay.motiononly.overlay':
    'Dependiste solo del movimiento. Se requiere un botón de salida manual en la ruta de egreso.',
  'sim.ac203.egress-fail.replay.nofacp.overlay':
    'Dejaste la cerradura fuera del panel de incendio. Debe liberarse ante una alarma de incendio.',
  'sim.ac203.media.storefront.alt':
    'Una puerta de vidrio de tienda asegurada por una cerradura magnética.',
  'sim.ac203.media.crowd_trapped.alt':
    'Personas agolpadas contra una puerta de vidrio cerrada, sin poder salir.',

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
