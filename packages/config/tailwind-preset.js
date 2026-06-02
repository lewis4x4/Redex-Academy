// Shared Tailwind preset for the Redex Academy apps (D1 design system).
// Every utility maps to a CSS variable defined in @redex/ui styles/tokens.css —
// the SINGLE source of truth. Components compose these token-backed classes and
// therefore never write a raw hex (enforced by the no-raw-hex ESLint rule).
// Dark is the brand default; the placeholder navy is GONE — brand is Redex red.
//
// Colorblind-safe (CODING_STANDARDS §9 / invariant 7): state color is NEVER the sole
// carrier of meaning — @redex/ui primitives pair every status with shape + text.
/** @type {Partial<import('tailwindcss').Config>} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand
        redex: {
          DEFAULT: 'var(--red)',
          bright: 'var(--red-bright)',
          deep: 'var(--red-deep)',
          dim: 'var(--red-dim)', // v2 faint red wash (bg-redex-dim)
        },
        canvas: 'var(--canvas)',
        panel: { DEFAULT: 'var(--panel)', 2: 'var(--panel-2)' },
        // line = the default hairline; line-strong = the v2 brighter hairline token.
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: {
          DEFAULT: 'var(--text)',
          // v2 pure-white keyword emphasis (the .kw highlight); body stays `ink`.
          strong: 'var(--text-strong)',
          muted: 'var(--muted)',
          dim: 'var(--dim)',
          soft: 'var(--text-soft)',
        },
        green: 'var(--green)',
        amber: 'var(--amber)',
        gold: 'var(--gold)',
        // v2 technical-value accent (warm gold) — bg-tech / text-tech / border-tech.
        tech: 'var(--tech)',
        // Academy verdict states — always paired with shape + text (never color-only).
        state: {
          pass: 'var(--state-pass)',
          fail: 'var(--state-fail)',
          veto: 'var(--state-veto)',
          pending: 'var(--state-pending)',
        },
        // Learning-domain hues
        domain: {
          fnd: 'var(--domain-fnd)',
          int: 'var(--domain-int)',
          adc: 'var(--domain-adc)',
          ac: 'var(--domain-ac)',
          vid: 'var(--domain-vid)',
          sec: 'var(--domain-sec)',
          locked: 'var(--border-locked)',
        },
        // Promoted surface literals
        surface: {
          hover: 'var(--surface-hover)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
          5: 'var(--surface-5)',
        },
        track: 'var(--fill-track)',
        'disabled-bg': 'var(--disabled-bg)',
        'disabled-fg': 'var(--disabled-fg)',
        // Translucent tints/edges (bg-red-tint, border-red-edge, …) + scrims.
        'red-tint': 'var(--red-tint)',
        'red-tint-soft': 'var(--red-tint-soft)',
        'red-edge': 'var(--red-edge)',
        'green-tint': 'var(--green-tint)',
        'green-edge': 'var(--green-edge)',
        'amber-tint': 'var(--amber-tint)',
        'amber-edge': 'var(--amber-edge)',
        'veto-tint': 'var(--veto-tint)',
        'veto-edge': 'var(--veto-edge)',
        'scrim-modal': 'var(--scrim-modal)',
        'scrim-drawer': 'var(--scrim-drawer)',
      },
      fontFamily: {
        // v2: display=Archivo (headings), sans=Inter (body), mono=IBM Plex Mono (tech).
        display: 'var(--font-display)',
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      fontWeight: {
        nav: '600',
        label: '700',
        bold: '800',
        // `black` (900) is the heaviest weight. NOTE: the `display` weight key was renamed
        // to `black` so `font-display` is free to be the Archivo FONT-FAMILY utility (v2);
        // display headings that want 900 now compose `font-display font-black`.
        black: '900',
      },
      fontSize: {
        micro: ['9px', '1.2'],
        // v2 eyebrow: mono 11px, 3px tracking, uppercase (the bar's .eyebrow).
        eyebrow: ['11px', { lineHeight: '1.4', letterSpacing: '3px' }],
        label: ['11px', '1.4'],
        caption: ['12px', '1.4'],
        // v2 body: ~15px Inter at the relaxed 1.72 reading line-height.
        body: ['13px', '1.5'],
        'body-lg': ['14px', '1.5'],
        prose: ['15px', '1.72'], // the v2 reading-measure body size
        // v2 lede: 18px / 1.55, ink-muted (the standout sentence under the h1).
        lede: ['18px', '1.55'],
        subtitle: ['16px', '1.4'],
        stat: ['17px', '1.05'],
        title: ['20px', '1.25'],
        // v2 display h1: 40px / 1.04 / -1.1px tracking, paired with font-display (Archivo 800).
        h1: ['40px', { lineHeight: '1.04', letterSpacing: '-1.1px' }],
        display: ['34px', '1.05'],
        'display-lg': ['44px', { lineHeight: '1.02', letterSpacing: '-1.4px' }],
      },
      lineHeight: {
        display: '1.04', // v2 Archivo display heading
        lede: '1.55', // v2 lede + .seq desc
        reading: '1.72', // v2 relaxed reading measure
      },
      letterSpacing: {
        tightmark: '-1px',
        tighttitle: '-0.4px',
        nav: '0.3px',
        name: '0.5px',
        label: '2px',
        eyebrow: '3px',
        wide: '5px',
      },
      borderRadius: {
        mark: '8px',
        control: '9px',
        card: '14px',
        panel: '16px',
        pill: '30px',
      },
      boxShadow: {
        glow: 'var(--glow)',
        'glow-soft': 'var(--glow-soft)',
        panel: 'var(--shadow-panel)',
        modal: 'var(--shadow-modal)',
        toast: 'var(--shadow-toast)',
        card: 'var(--shadow-card)',
      },
      backgroundImage: {
        'grad-cta': 'var(--grad-cta)',
        'grad-header': 'var(--grad-header)',
        'grad-panel': 'var(--grad-panel)',
        'grad-score': 'var(--grad-score-fill)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        slide: 'var(--ease-slide)',
        overshoot: 'var(--ease-overshoot)',
      },
      transitionDuration: {
        hover: '180ms',
        nav: '220ms',
        screen: '350ms',
        meter: '450ms',
        slideover: '420ms',
      },
    },
  },
  plugins: [],
};
