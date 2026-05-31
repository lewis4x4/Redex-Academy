import { initI18n } from '@redex/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeCheck } from './KnowledgeCheck';
import type { RenderableItem } from './lessonSource';

// Mock the offline queue (append-only recorder) + the supabase Edge Function call.
type AppendEvent = { table: string; op: string; payload: Record<string, unknown> };
const h = vi.hoisted(() => ({
  enqueue: vi.fn(async (_e: { table: string; op: string; payload: Record<string, unknown> }) => {}),
  invoke: vi.fn(async () => ({ data: { passed: true }, error: null })),
}));
vi.mock('../offline/sync-queue', () => ({ enqueue: h.enqueue }));
vi.mock('../auth/supabaseClient', () => ({
  supabase: { functions: { invoke: h.invoke } },
}));

const mcq = (id: string, safety: boolean, correct: string): RenderableItem => ({
  id,
  kind: 'mcq',
  is_safety_item: safety,
  mastery_weight: 1,
  answer_key: { correct },
  prompt: { text: `Q ${id}` },
  options: {
    choices: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
  },
});

const items: RenderableItem[] = [mcq('s1', true, 'a'), mcq('n1', false, 'a')];

function renderKC(online = true) {
  let n = 0;
  return render(
    <KnowledgeCheck
      kcUnitId="00000000-0000-0000-0000-0000000000kc"
      items={items}
      userId="u1"
      orgId="o1"
      online={online}
      genUuid={() => `uuid-${n++}`}
      now={() => '2026-05-31T00:00:00.000Z'}
    />,
  );
}
const pick = (itemId: string, choiceId: string) =>
  fireEvent.click(
    screen
      .getByTestId('knowledge-check')
      .querySelector(`[data-item="${itemId}"] [data-choice="${choiceId}"]`)!,
  );

describe('KnowledgeCheck — retry-to-mastery (render-only; server is authoritative)', () => {
  beforeEach(() => {
    h.enqueue.mockClear();
    h.invoke.mockClear();
    initI18n('en');
  });

  it('records responses append-only and reflects the SERVER pass (does not self-promote)', async () => {
    h.invoke.mockResolvedValueOnce({ data: { passed: true }, error: null });
    renderKC();
    pick('s1', 'a');
    pick('n1', 'a');
    fireEvent.click(screen.getByTestId('kc-submit'));
    await waitFor(() => expect(screen.getByTestId('kc-verdict')).toBeInTheDocument());
    // the server verdict drove the outcome (we invoked the server-only function)
    expect(h.invoke).toHaveBeenCalledWith('grade-knowledge-check', {
      body: { unit_id: '00000000-0000-0000-0000-0000000000kc' },
    });
    // responses were recorded append-only (one event per answered item, graded_by auto, no score)
    expect(h.enqueue).toHaveBeenCalledTimes(2);
    const ev = h.enqueue.mock.calls[0]![0] as AppendEvent;
    expect(ev.table).toBe('assessment_responses');
    expect(ev.op).toBe('append');
    expect(ev.payload.graded_by).toBe('auto');
    expect('score' in ev.payload).toBe(false);
    expect(screen.getByTestId('kc-verdict')).toHaveTextContent('Mastered');
  });

  it('a failed safety item → server returns not-passed → retry shown; retry increments attempt', async () => {
    h.invoke.mockResolvedValue({ data: { passed: false }, error: null });
    renderKC();
    pick('s1', 'b'); // wrong safety answer
    pick('n1', 'a');
    fireEvent.click(screen.getByTestId('kc-submit'));
    await waitFor(() => expect(screen.getByTestId('kc-retry')).toBeInTheDocument());
    expect(screen.getByTestId('kc-verdict')).toHaveTextContent('retry');
    // local grade agrees it's not a pass (50% safety < 90%)
    expect(screen.getByTestId('kc-local-pass')).toHaveTextContent('false');

    fireEvent.click(screen.getByTestId('kc-retry'));
    // the next submission is attempt 2 (append events carry the incremented attempt)
    h.enqueue.mockClear();
    pick('s1', 'a'); // fix it
    h.invoke.mockResolvedValueOnce({ data: { passed: true }, error: null });
    fireEvent.click(screen.getByTestId('kc-submit'));
    await waitFor(() => expect(h.enqueue).toHaveBeenCalled());
    expect((h.enqueue.mock.calls[0]![0] as AppendEvent).payload.attempt).toBe(2);
  });

  it('offline: queues responses + shows pending_offline, never a faked pass', async () => {
    renderKC(false);
    pick('s1', 'a');
    pick('n1', 'a');
    fireEvent.click(screen.getByTestId('kc-submit'));
    await waitFor(() => expect(screen.getByTestId('kc-verdict')).toBeInTheDocument());
    expect(h.enqueue).toHaveBeenCalledTimes(2); // recorded offline
    expect(h.invoke).not.toHaveBeenCalled(); // never asks the server offline
    expect(screen.getByText(/Saved offline/i)).toBeInTheDocument();
  });
});
