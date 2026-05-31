import { Toast, ToastStack } from '@redex/ui';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SW_UPDATE_EVENT, applyUpdate, isUpdatePending } from './registerSW';

/**
 * Surfaces a waiting service-worker update as a sticky, accessible toast: "A new
 * version is available" + a Reload action (skip-waits the new SW and reloads) and
 * a Dismiss (hides until the next check). Mounted once at the app root so it
 * covers every route. This is the missing half of the `registerType: 'prompt'`
 * flow — without it a deploy installs but never activates, and the page keeps
 * serving the OLD cached shell.
 *
 * Colorblind-safe: the message is plain text (the Toast carries no color-only
 * meaning); both actions are real, keyboard-reachable <button>s. The ToastStack
 * is a polite live region, so the notice is announced without interrupting.
 */
export function UpdatePrompt(): ReactElement | null {
  const { t } = useTranslation();
  // Seed from the module flag too: the SW may have reported "waiting" before this
  // component mounted, so the one-shot event would already have fired.
  const [show, setShow] = useState<boolean>(() => isUpdatePending());

  useEffect(() => {
    const onUpdate = () => setShow(true);
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
  }, []);

  if (!show) return null;

  return (
    <ToastStack data-testid="sw-update-prompt">
      <Toast>
        <span>{t('pwa.update.available')}</span>
        <span className="ml-1 inline-flex items-center gap-2">
          <button
            type="button"
            data-testid="sw-update-reload"
            onClick={() => applyUpdate()}
            className="rounded-pill border border-redex bg-surface-2 px-3 py-1 font-label text-white hover:bg-surface-hover"
          >
            {t('pwa.update.reload')}
          </button>
          {/* aria-label leads with the visible word ("Later, dismiss…") so the
              accessible name CONTAINS the visible label — WCAG 2.5.3 Label in Name,
              so voice control on "Later" still activates it. Don't drop the prefix. */}
          <button
            type="button"
            data-testid="sw-update-dismiss"
            onClick={() => setShow(false)}
            aria-label={t('pwa.update.dismiss')}
            className="rounded-pill px-2 py-1 font-label text-ink-soft hover:text-white"
          >
            {t('pwa.update.dismiss_short')}
          </button>
        </span>
      </Toast>
    </ToastStack>
  );
}
