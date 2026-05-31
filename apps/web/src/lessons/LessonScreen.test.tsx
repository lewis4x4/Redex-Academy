import { initI18n } from '@redex/i18n';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('LessonScreen — MDX lesson renders embedded components (AC-101)', () => {
  beforeEach(() => {
    initI18n('en');
    h.loadLesson.mockResolvedValue({
      unitId: 'ac101-u1',
      courseVersionId: 'cv-ac101',
      title: 'The Five Components & the Access Event',
      mdxKey: 'ac-101/u1',
      knowledgeCheck: { unitId: 'ac101-kc', items: [safetyMcq] },
    });
  });

  it('compiles the MDX body and renders the Callout, the 2D Sim, and the KnowledgeCheck', async () => {
    render(<LessonScreen unitId="ac101-u1" />);
    // the MDX compiles asynchronously → wait for the body
    await waitFor(() => expect(screen.getByTestId('lesson-body')).toBeInTheDocument());
    // <Callout tone="safety"> from the MDX prose
    const note = screen.getByRole('note');
    expect(note).toHaveAttribute('data-tone', 'safety');
    // <Sim spec="ac-101/anatomy-of-a-door" /> → the interaction-2d renderer mounted
    expect(screen.getByTestId('i2d-submit')).toBeInTheDocument();
    // <KnowledgeCheck /> resolved from lesson context
    expect(screen.getByTestId('knowledge-check')).toBeInTheDocument();
    // the locale toggle is present (EN↔ES)
    expect(screen.getByTestId('lesson-locale-toggle')).toHaveTextContent('en');
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
