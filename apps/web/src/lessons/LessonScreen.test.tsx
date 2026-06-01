import { i18n, initI18n } from '@redex/i18n';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderableItem } from './lessonSource';

// Mock identity + the data layer + offline sinks; the MDX body itself is the REAL
// committed ac-101/u1 content (bundled), compiled by the real @mdx-js/mdx evaluate.
const h = vi.hoisted(() => ({
  loadLesson: vi.fn(),
  enqueue: vi.fn(async () => {}),
  enqueueXapi: vi.fn(async () => {}),
}));
vi.mock('./lessonSource', async (orig) => ({
  ...(await orig<typeof import('./lessonSource')>()),
  loadLesson: h.loadLesson,
}));
vi.mock('../offline/sync-queue', () => ({ enqueue: h.enqueue }));
vi.mock('../offline/xapi-queue', () => ({ enqueueXapi: h.enqueueXapi }));
vi.mock('../auth/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, claims: { org_id: 'o1' }, loading: false }),
  signOut: vi.fn(),
}));

import { LessonScreen } from './LessonScreen';

const safetyMcq: RenderableItem = {
  id: 's1',
  kind: 'mcq',
  is_safety_item: true,
  mastery_weight: 1,
  answer_key: { correct: 'a' },
  prompt: { text: 'Fail-safe means…' },
  options: {
    choices: [
      { id: 'a', text: 'releases on power loss' },
      { id: 'b', text: 'stays locked' },
    ],
  },
};

describe('LessonScreen — paced step runner (AC-101 MDX)', () => {
  beforeEach(() => {
    initI18n('en');
    // initI18n is idempotent — reset the shared singleton to EN so a prior test's
    // EN↔ES toggle doesn't leak into the next test.
    void i18n.changeLanguage('en');
    h.loadLesson.mockResolvedValue({
      unitId: 'ac101-u1',
      courseVersionId: 'cv-ac101',
      title: 'The Five Components & the Access Event',
      mdxKey: 'ac-101/u1',
      knowledgeCheck: { unitId: 'ac101-kc', items: [safetyMcq] },
    });
  });

  it('renders step 1 with the Callout + the 2D Sim, paced behind the step runner', async () => {
    render(<LessonScreen unitId="ac101-u1" />);
    // the runner frame + the first step compile asynchronously
    await waitFor(() => expect(screen.getByTestId('lesson-screen')).toBeInTheDocument());
    const step1 = await screen.findByTestId('step-content');
    expect(step1).toHaveAttribute('data-step', '1');
    // <Callout tone="safety"> from the intro prose, now step 1
    expect(within(step1).getByRole('note')).toHaveAttribute('data-tone', 'safety');
    // <Sim spec="ac-101/anatomy-of-a-door" /> → the interaction-2d renderer mounted,
    // framed by the SimulatorPanel centerpiece
    expect(screen.getByTestId('i2d-submit')).toBeInTheDocument();
    expect(screen.getByTestId('simulator-panel')).toBeInTheDocument();
    // the KC is NOT on screen yet (it is the terminal step)
    expect(screen.queryByTestId('knowledge-check')).not.toBeInTheDocument();
    // the locale toggle is in the header (EN↔ES)
    expect(screen.getByTestId('lesson-locale-toggle')).toHaveTextContent('en');
  });

  it('walks Next to the terminal Knowledge-check step', async () => {
    render(<LessonScreen unitId="ac101-u1" />);
    await screen.findByTestId('i2d-submit');
    // advance to the KC step (last step)
    screen.getByTestId('lesson-next').click();
    await waitFor(() =>
      expect(screen.getByTestId('step-content')).toHaveAttribute('data-step', '2'),
    );
    expect(await screen.findByTestId('knowledge-check')).toBeInTheDocument();
    // on the last step the primary button flips to "Continue the course"
    expect(screen.getByTestId('lesson-next')).toHaveTextContent('Continue the course');
  });

  it('ArrowDown / ArrowUp page between steps (suppressed inside form controls)', async () => {
    render(<LessonScreen unitId="ac101-u1" />);
    await screen.findByTestId('i2d-submit');
    // ArrowDown advances to the KC step
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(screen.getByTestId('step-content')).toHaveAttribute('data-step', '2'),
    );
    // ArrowUp goes back to step 1
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    await waitFor(() =>
      expect(screen.getByTestId('step-content')).toHaveAttribute('data-step', '1'),
    );
    // with focus inside a KC radio (a form control), Arrow keys are NOT stolen for nav
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await screen.findByTestId('knowledge-check');
    const radio = document.querySelector('[data-item="s1"] [data-choice="a"]') as HTMLElement;
    radio.focus();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    // still on the KC step — the form control kept the arrow key
    expect(screen.getByTestId('step-content')).toHaveAttribute('data-step', '2');
  });

  it('the header locale toggle flips the KC chrome EN↔ES on the current step', async () => {
    render(<LessonScreen unitId="ac101-u1" />);
    await screen.findByTestId('i2d-submit');
    screen.getByTestId('lesson-next').click();
    await screen.findByTestId('knowledge-check');
    expect(screen.getByTestId('kc-submit')).toHaveTextContent('Check answers');
    screen.getByTestId('lesson-locale-toggle').click();
    // the current step re-evaluates in ES
    await waitFor(() =>
      expect(screen.getByTestId('kc-submit')).toHaveTextContent('Comprobar respuestas'),
    );
  });

  it('shows a graceful error when the lesson has no committed MDX body', async () => {
    h.loadLesson.mockResolvedValueOnce({
      unitId: 'x',
      courseVersionId: 'cv',
      title: 'Missing',
      mdxKey: 'does-not-exist/u9',
      knowledgeCheck: null,
    });
    render(<LessonScreen unitId="x" />);
    await waitFor(() => expect(screen.getByText(/Couldn't load this lesson/i)).toBeInTheDocument());
  });
});
