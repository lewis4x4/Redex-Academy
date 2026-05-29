import { StatusBadge } from '@redex/ui';
import { useTranslation } from 'react-i18next';

/**
 * F1 app shell. Proves the workspace graph resolves end to end: the web app
 * consumes the shared UI primitive (@redex/ui) and the i18n layer (@redex/i18n
 * via react-i18next). Real routing, auth, and feature surfaces arrive in later
 * goals (F3+, M1+).
 */
export default function App() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-redex">{t('app.title')}</h1>
          <p className="text-lg text-slate-600">{t('app.tagline')}</p>
        </header>
        <section aria-label="Build status" className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Foundation scaffold (F1):</span>
          <StatusBadge kind="pending" label="Shell ready" />
        </section>
      </div>
    </main>
  );
}
