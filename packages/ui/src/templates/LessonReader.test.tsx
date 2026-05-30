import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LessonReader } from './LessonReader';

describe('LessonReader', () => {
  it('renders the content slot inside a centered prose column', () => {
    render(<LessonReader>Lesson body copy</LessonReader>);
    const body = screen.getByText('Lesson body copy');
    expect(body).toBeInTheDocument();
    // comfortable measure + relaxed line-height on the reading column
    expect(body.className).toContain('max-w-[68ch]');
    expect(body.className).toContain('leading-relaxed');
  });

  it('shows the on-brand EmptyState placeholder when no content is supplied', () => {
    render(<LessonReader />);
    // EmptyState announces politely via role="status"
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('No lesson content yet')).toBeInTheDocument();
  });

  it('renders the header slot in a real <header> when provided', () => {
    const { container } = render(
      <LessonReader header={<span>Egress fundamentals</span>}>Body</LessonReader>,
    );
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(screen.getByText('Egress fundamentals')).toBeInTheDocument();
  });

  it('renders the optional right rail as a labelled <aside> only when provided', () => {
    const { rerender } = render(<LessonReader>Body</LessonReader>);
    expect(screen.queryByRole('complementary')).toBeNull();

    rerender(<LessonReader aside={<div>Table of contents</div>}>Body</LessonReader>);
    const aside = screen.getByRole('complementary', { name: 'Lesson sidebar' });
    expect(aside).toBeInTheDocument();
    expect(screen.getByText('Table of contents')).toBeInTheDocument();
  });

  it('renders the footerNav slot in a labelled <nav> only when provided', () => {
    const { rerender } = render(<LessonReader>Body</LessonReader>);
    expect(screen.queryByRole('navigation')).toBeNull();

    rerender(
      <LessonReader footerNav={<button type="button">Next lesson</button>}>Body</LessonReader>,
    );
    const nav = screen.getByRole('navigation', { name: 'Lesson navigation' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next lesson' })).toBeInTheDocument();
  });

  it('uses a semantic <article> wrapper, forwards its ref, and merges className + rest props', () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(
      <LessonReader ref={ref} className="custom-x" data-testid="reader">
        Body
      </LessonReader>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    const article = container.querySelector('article');
    expect(article).not.toBeNull();
    expect(article?.className).toContain('custom-x');
    expect(screen.getByTestId('reader')).toBe(article);
    // token discipline: no raw hex ever lands in the rendered class list
    expect(article?.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
