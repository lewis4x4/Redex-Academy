import { initI18n } from '@redex/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App shell (workspace smoke)', () => {
  it('renders the academy title via @redex/i18n + @redex/ui', () => {
    initI18n();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Redex Academy');
    // The shared colorblind-safe primitive resolved from @redex/ui.
    expect(screen.getByRole('status')).toHaveTextContent('Shell ready');
  });
});
