/**
 * Shared xAPI telemetry emitter (F5 §3). EVERY engine emits through this — one
 * statement shape (actor/verb/object/result/context per the envelope's
 * $defs/xapiTelemetryEvent), each carrying a client-minted `client_event_uuid`
 * (THE idempotency key, ledger §G). Statements are pushed to a sink: in the app
 * that sink is F4's offline Dexie queue (flushed via /sync); the LRS bridge is M8.
 * F5 only constructs + queues — it never forwards and never calls an LLM.
 */
import { XAPI_EXT, type EngineKind, type XapiTelemetryEvent } from '@redex/sim-schemas';
import type { TelemetrySink } from '../api';

export const XAPI_VERBS = {
  attempted: 'http://adlnet.gov/expapi/verbs/attempted',
  answered: 'http://adlnet.gov/expapi/verbs/answered',
  completed: 'http://adlnet.gov/expapi/verbs/completed',
  triggeredSafetyVeto: 'https://academy.goredex.com/xapi/verbs/triggered-safety-veto',
} as const;

const ACTIVITY_BASE = 'https://academy.goredex.com/sim';

export interface EmitterDeps {
  simId: string;
  engineKind: EngineKind;
  actor: { homePage: string; name: string };
  context?: {
    org_id?: string;
    sim_definition_id?: string;
    registration?: string;
    offline?: boolean;
  };
  sink?: TelemetrySink;
  genUuid: () => string;
  now: () => string;
}

export interface EmitArgs {
  verb: string;
  /** In-spec element id (node, assertion) appended to the activity IRI. */
  objectId?: string;
  objectName?: Record<string, string>;
  result?: XapiTelemetryEvent['result'];
}

export interface Emitter {
  emit(args: EmitArgs): XapiTelemetryEvent;
  subscribe(cb: TelemetrySink): () => void;
  verbs: typeof XAPI_VERBS;
}

export function createEmitter(deps: EmitterDeps): Emitter {
  const subscribers = new Set<TelemetrySink>();
  if (deps.sink) subscribers.add(deps.sink);

  const objectIri = (elementId?: string) =>
    `${ACTIVITY_BASE}/${deps.simId}${elementId ? `/${elementId}` : ''}`;

  const ctxExtensions: Record<string, unknown> = {
    [XAPI_EXT.engineKind]: deps.engineKind,
  };
  if (deps.context?.org_id) ctxExtensions[XAPI_EXT.orgId] = deps.context.org_id;
  if (deps.context?.sim_definition_id)
    ctxExtensions[XAPI_EXT.simDefId] = deps.context.sim_definition_id;
  if (deps.context?.offline !== undefined)
    ctxExtensions[XAPI_EXT.offlineOrigin] = deps.context.offline;

  function emit(args: EmitArgs): XapiTelemetryEvent {
    const event: XapiTelemetryEvent = {
      client_event_uuid: deps.genUuid(),
      actor: {
        objectType: 'Agent',
        account: { homePage: deps.actor.homePage, name: deps.actor.name },
      },
      verb: { id: args.verb },
      object: {
        id: objectIri(args.objectId),
        objectType: 'Activity',
        ...(args.objectName ? { definition: { name: args.objectName } } : {}),
      },
      ...(args.result ? { result: args.result } : {}),
      context: {
        ...(deps.context?.registration ? { registration: deps.context.registration } : {}),
        extensions: ctxExtensions,
      },
      timestamp: deps.now(),
    };
    for (const s of subscribers) void s(event);
    return event;
  }

  return {
    emit,
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    verbs: XAPI_VERBS,
  };
}

/** Build the result block for the attempt-summary statement from a Verdict. */
export function resultFromVerdict(v: {
  outcome: 'pass' | 'fail';
  safety_veto_triggered: boolean;
  score: { scaled: number; raw: number; max: number };
}): NonNullable<XapiTelemetryEvent['result']> {
  return {
    success: v.outcome === 'pass',
    completion: true,
    score: {
      scaled: Math.max(-1, Math.min(1, v.score.scaled)),
      raw: v.score.raw,
      min: 0,
      max: v.score.max,
    },
    extensions: { [XAPI_EXT.safetyVeto]: v.safety_veto_triggered },
  };
}
