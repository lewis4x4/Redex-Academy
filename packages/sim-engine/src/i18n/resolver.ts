/**
 * Sim i18n string resolver (F5 §4). All learner-visible sim text is an i18nKey
 * (never raw text in a spec); the resolver maps key → string in the active locale,
 * EN-first with EN fallback. The LOCKED safety glossary (@redex/i18n) is merged in
 * as NON-OVERRIDABLE: a sim string table can never shadow a `safety.glossary.*`
 * term, so fail-safe/fail-locked/REX/egress/partition render identically in every
 * locale (CLAUDE.md §7). ES safety terms stay SME-placeholder until SME review.
 */
import { SAFETY_GLOSSARY } from '@redex/i18n';

export type SimLocale = 'en' | 'es';

export interface SimStringTable {
  en: Record<string, string>;
  es: Record<string, string>;
}

export interface I18nResolver {
  locale: SimLocale;
  t(key: string): string;
  has(key: string): boolean;
}

export function createI18nResolver(table: SimStringTable, locale: SimLocale = 'en'): I18nResolver {
  const glossary = new Map<string, Record<SimLocale, string>>();
  for (const g of SAFETY_GLOSSARY) glossary.set(g.key, { en: g.term.en, es: g.term.es });

  return {
    locale,
    t(key: string): string {
      const locked = glossary.get(key); // non-overridable safety glossary wins
      if (locked) return locked[locale] || locked.en;
      const localized = table[locale]?.[key];
      if (localized !== undefined) return localized;
      return table.en[key] ?? key; // EN fallback, then the key itself
    },
    has(key: string): boolean {
      return glossary.has(key) || key in (table[locale] ?? {}) || key in table.en;
    },
  };
}
