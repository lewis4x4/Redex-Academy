import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';

export const defaultNS = 'common' as const;

export const resources = {
  en: { common: enCommon },
  es: { common: esCommon },
} as const;

export type AppLocale = keyof typeof resources;

/**
 * Initialize the shared react-i18next instance (idempotent). EN+ES are
 * first-class for all 1xx/2xx content; the locked safety glossary (./glossary)
 * is never machine-translated and renders identically across locales.
 */
export function initI18n(lng: AppLocale = 'en') {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'en',
      defaultNS,
      ns: ['common'],
      interpolation: { escapeValue: false },
    });
  }
  return i18n;
}

export { i18n };
export * from './glossary';
