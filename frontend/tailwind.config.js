/**
 * ============================================================================
 * 🔒 SHARED THEME — DO NOT EDIT INDIVIDUALLY
 * ============================================================================
 * Owned by the repo initializer. Any change = chore/contract/theme PR with
 * 2 approvals, so all four members stay visually identical.
 *
 * Brand:  Electric Mint #10B981 · Deep Cyber Blue #0F172A · Voltage Violet #7C3AED
 * Mood:   modern fintech-meets-EV — clean and trustworthy
 * Scope:  LIGHT MODE ONLY. Do not write `dark:` variants.
 *
 * Every colour points at a CSS variable defined in src/app/globals.css, so a
 * palette fix is one line there and touches nobody's feature folder.
 *
 * ❌ NEVER write raw hex, bg-[#10B981], or default Tailwind colours
 *    (bg-emerald-500, text-slate-700) inside src/features/ or src/app/.
 * ✅ ALWAYS use the semantic tokens below: bg-surface, text-ink, border-line,
 *    bg-brand-primary, text-ink-muted, bg-warning-subtle …
 * ============================================================================
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: false, // light only — see design system §7.7 rule 6
  content: ['./src/**/*.{js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* ------------------------------------------------------ brand --- */
        brand: {
          primary: 'var(--brand-primary)',
          'primary-hover': 'var(--brand-primary-hover)',
          'primary-subtle': 'var(--brand-primary-subtle)',
          secondary: 'var(--brand-secondary)',
          'secondary-soft': 'var(--brand-secondary-soft)',
          accent: 'var(--brand-accent)',
          'accent-subtle': 'var(--brand-accent-subtle)',
        },

        /* --------------------------------------------------- surfaces --- */
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
          inverse: 'var(--surface-inverse)',
        },

        /* ------------------------------------------------------- text --- */
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          subtle: 'var(--ink-subtle)',
          inverse: 'var(--ink-inverse)',
          brand: 'var(--ink-brand)',
        },

        /* ------------------------------------------------------ lines --- */
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },

        /* --------------------------------------------------- feedback --- */
        success: {
          DEFAULT: 'var(--success)',
          subtle: 'var(--success-subtle)',
          fg: 'var(--success-fg)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          subtle: 'var(--warning-subtle)',
          fg: 'var(--warning-fg)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          subtle: 'var(--danger-subtle)',
          fg: 'var(--danger-fg)',
        },
        info: {
          DEFAULT: 'var(--info)',
          subtle: 'var(--info-subtle)',
          fg: 'var(--info-fg)',
        },

        /* ---------------------------------------- domain (ParkShare) ---- */
        // Meaning is fixed. Don't reuse these for decoration.
        charge: { live: 'var(--brand-primary)' },
        tariff: {
          peak: 'var(--danger)',
          standard: 'var(--info)',
          offpeak: 'var(--success)',
        },
        escrow: {
          held: 'var(--warning)',
          released: 'var(--success)',
        },
        property: {
          residential: 'var(--info)',
          mall: 'var(--brand-accent)',
        },
      },

      fontFamily: {
        // Loaded via next/font in src/app/layout.js
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],   // Manrope
        sans: ['var(--font-sans)', 'Noto Sans Bengali', 'system-ui', 'sans-serif'], // Inter
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],       // JetBrains Mono
      },

      fontSize: {
        'display-lg': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        display: ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        h1: ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        h2: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        h3: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.375rem' }],
        caption: ['0.75rem', { lineHeight: '1.125rem' }],
        overline: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '600' }],
      },

      borderRadius: {
        sm: '6px',
        DEFAULT: '10px', // inputs + buttons
        md: '10px',
        lg: '14px',      // cards
        xl: '20px',      // modals / sheets
      },

      boxShadow: {
        1: '0 1px 2px rgb(15 23 42 / 0.06), 0 1px 3px rgb(15 23 42 / 0.04)',
        2: '0 4px 12px rgb(15 23 42 / 0.08)',
        3: '0 12px 32px rgb(15 23 42 / 0.14)',
        'glow-charge': '0 0 0 4px rgb(16 185 129 / 0.18)',
        focus: '0 0 0 3px rgb(16 185 129 / 0.35)',
      },

      transitionDuration: { fast: '120ms', base: '200ms', slow: '320ms' },

      keyframes: {
        // THE SIGNATURE ELEMENT. Means exactly one thing: energy is flowing now.
        // Allowed in 3 places only — see docs/04-design-system.md.
        chargePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(16 185 129 / 0.35)' },
          '50%': { boxShadow: '0 0 0 8px rgb(16 185 129 / 0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'charge-pulse': 'chargePulse 2s ease-in-out infinite',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
