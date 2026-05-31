import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal in-app routing for the authed shell. M1 left routing as a
 * window.location switch (no react-router); M3 adds a tiny query-param route so a
 * learner can enter the AC-203 sim from the Constellation and return. Reads
 * `?screen=` / `?course=`; navigate() pushes history + notifies every hook
 * instance via a custom event (so App + Constellation re-render together).
 */
export interface AppRoute {
  screen: string | null;
  course: string | null;
}

const NAV_EVENT = 'rdx:navigate';

function parse(): AppRoute {
  if (typeof window === 'undefined') return { screen: null, course: null };
  const p = new URLSearchParams(window.location.search);
  return { screen: p.get('screen'), course: p.get('course') };
}

export function useAppRoute(): { route: AppRoute; navigate: (next: Partial<AppRoute>) => void } {
  const [route, setRoute] = useState<AppRoute>(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('popstate', onChange);
    window.addEventListener(NAV_EVENT, onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(NAV_EVENT, onChange);
    };
  }, []);

  const navigate = useCallback((next: Partial<AppRoute>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v == null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    window.history.pushState({}, '', qs ? `?${qs}` : window.location.pathname);
    window.dispatchEvent(new Event(NAV_EVENT));
  }, []);

  return { route, navigate };
}
