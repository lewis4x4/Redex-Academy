// Lesson stepping (AC-203 course-experience, Phase 1). Pre-splits a committed MDX
// lesson body into discrete steps at its `## ` section headings, so the paced step
// runner can evaluate ONE step's chunk at a time. The leading `# ` title + intro prose
// before the first `## ` is NOT a step — it is the lesson title (shown in the header).
// No step-delimiter tags are added to the MDX; the authored `## ` boundaries are the
// source of truth (CLAUDE.md: content is not reimplemented).

export interface LessonStep {
  /** 1-based position among the `## ` sections. */
  ordinal: number;
  /** The `## ` heading text (the step title). */
  title: string;
  /** The raw MDX of this section's body (the lines AFTER its `## ` heading, up to the next). */
  rawMdx: string;
  /** True if the section embeds a `<KnowledgeCheck` tag (the terminal mastery gate). */
  hasKnowledgeCheck: boolean;
}

// Embeddable MDX component tags. The `# ` title + the prose lede before the first `## `
// is HEADER material (the lesson title is shown in the runner header, not a step) — UNLESS
// that pre-heading block itself teaches with an embedded component (a `<Sim>`/`<Checklist>`
// etc.), in which case it is a real first step. AC-203's intro is pure prose → excluded
// (7 steps); AC-101's intro embeds the anatomy `<Sim>` → it becomes step 1.
const COMPONENT_TAG = /<(Sim|Callout|Checklist|KnowledgeCheck|Media)\b/;

/** Strip the leading `# ` title line from a pre-heading intro block (keep the prose). */
function dropTitleLine(lines: string[]): string[] {
  let started = false;
  const out: string[] = [];
  for (const line of lines) {
    if (!started && line.startsWith('# ')) {
      started = true; // drop exactly the title line; keep everything after it
      continue;
    }
    started = true;
    out.push(line);
  }
  return out;
}

/**
 * Split a raw MDX lesson body into steps at `^## ` headings. The `# ` title line is always
 * dropped (the runner shows it in the header). The intro prose before the first `## ` is
 * NOT a step UNLESS it embeds a teaching component — then it is step 1 ("Overview"). Each
 * step's `rawMdx` is the body between its heading and the next (the heading line itself is
 * excluded — the runner renders the title from `step.title`). `hasKnowledgeCheck` flags the
 * step that embeds `<KnowledgeCheck`.
 */
export function splitMdxByHeadings(raw: string): LessonStep[] {
  const lines = raw.split('\n');
  const steps: LessonStep[] = [];
  let current: { title: string; body: string[] } | null = null;
  const intro: string[] = [];
  let seenHeading = false;

  for (const line of lines) {
    // A step boundary is a level-2 heading (`## `), never the level-1 title (`# `) or
    // a deeper heading (`### `). startsWith('## ') with the trailing space excludes `###`.
    if (line.startsWith('## ')) {
      seenHeading = true;
      if (current) steps.push(finalize(current, steps.length + 1));
      current = { title: line.slice(3).trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      intro.push(line); // pre-first-heading lines (title + intro/lede)
    }
  }
  if (current) steps.push(finalize(current, steps.length + 1));

  // Promote the intro to a leading step only when it embeds a teaching component.
  const introBody = dropTitleLine(intro).join('\n');
  if (COMPONENT_TAG.test(introBody)) {
    const introStep = finalize({ title: 'Overview', body: introBody.split('\n') }, 1);
    steps.unshift(introStep);
    // re-number after unshift so ordinals stay 1..n
    steps.forEach((s, i) => {
      s.ordinal = i + 1;
    });
  }
  // (When there is no `## ` heading at all, a component-bearing intro still yields one step.)
  void seenHeading;
  return steps;
}

function finalize(current: { title: string; body: string[] }, ordinal: number): LessonStep {
  // Trim leading/trailing blank lines so each chunk is a clean MDX fragment.
  const rawMdx = current.body.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return {
    ordinal,
    title: current.title,
    rawMdx,
    hasKnowledgeCheck: /<KnowledgeCheck\b/.test(rawMdx),
  };
}
