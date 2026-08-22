# ParkShare & Charge — Design System

**🔒 Owned by the repo initializer.** `tailwind.config.js` and `src/app/globals.css` are frozen. Any change is a `chore/contract/theme` PR with 2 approvals.

**Brand:** Electric Mint `#10B981` · Deep Cyber Blue `#0F172A` · Voltage Violet `#7C3AED`
**Mood:** modern fintech-meets-EV — clean and trustworthy
**Scope:** light mode only. No `dark:` variants anywhere.

---

## The one rule

Never type a colour. Type a token.

```jsx
// ❌ all four of these fail `npm run check:tokens`
<div className="bg-[#10B981]" />
<div className="bg-emerald-500" />
<div style={{ color: '#0F172A' }} />
<div className="bg-white dark:bg-slate-900" />

// ✅
<div className="bg-brand-primary text-white" />
<div className="bg-surface text-ink border border-line" />
```

Fintech design means restraint: high contrast, generous whitespace, tabular numbers, nothing decorative. EV means energy and live telemetry. The resolution is **one loud place, everything else quiet** — mint is reserved for *live energy and primary action* and is never used as decoration.

---

## Colour tokens

### Brand

| Token class | Value | Use |
|---|---|---|
| `bg-brand-primary` | `#10B981` | Primary buttons, active nav, live charging, money-in |
| `bg-brand-primary-hover` | `#059669` | Hover / pressed |
| `bg-brand-primary-subtle` | `#ECFDF5` | Tinted backgrounds, selected map pins |
| `bg-brand-secondary` | `#0F172A` | Inverse surfaces, headers |
| `bg-brand-secondary-soft` | `#1E293B` | Raised surface on an inverse background |
| `bg-brand-accent` | `#7C3AED` | Mall / commercial / promo identity **only** |

### Surfaces, text, lines

| Token | Use |
|---|---|
| `bg-surface` / `bg-surface-raised` / `bg-surface-sunken` / `bg-surface-inverse` | Page · cards · wells · dark panels |
| `text-ink` / `text-ink-muted` / `text-ink-subtle` / `text-ink-inverse` / `text-ink-brand` | Primary · labels · placeholders · on-dark · mint text |
| `border-line` / `border-line-strong` | Default border · table rules |

### Feedback

`success` · `warning` · `danger` · `info` — each with `-subtle` (background) and `-fg` (text). Example: `bg-danger-subtle text-danger-fg`.

### Domain tokens

Meaning is fixed. Do not reuse for decoration.

| Token | Meaning | Used by |
|---|---|---|
| `charge-live` | Energy flowing now | `[MI]` `[SMR]` |
| `tariff-peak` / `tariff-standard` / `tariff-offpeak` | BERC period | `[GG]` |
| `escrow-held` / `escrow-released` | Funds state | `[TDN]` `[SMR]` |
| `property-residential` / `property-mall` | Listing category | `[TDN]` `[MI]` |

---

## Booking status → badge

Never build your own status chip. Import the shared one:

```jsx
import StatusBadge from '@/components/ui/StatusBadge';
<StatusBadge status={booking.status} />
```

| Status | Token | Treatment |
|---|---|---|
| `PENDING_PAYMENT` | warning | Solid chip |
| `CONFIRMED` | info | Solid chip |
| `EN_ROUTE` | accent | Solid chip |
| `ACTIVE` | primary | Chip **+ charge pulse** |
| `COMPLETED` | success-subtle | Quiet chip |
| `CANCELLED` / `EXPIRED` | muted | Deliberately dead |
| `OVERSTAY` | danger | Solid chip |
| `DISPUTED` | danger-outline | Outline = under review, not failed |

The map lives in `frontend/src/lib/constants.js` and `backend/shared/constants.js` as `BOOKING_STATUS_THEME`.

---

## Typography

| Class | Face | Use |
|---|---|---|
| `font-display` | **Manrope** 600/700/800 | Page titles, hero figures, earnings numbers |
| `font-sans` | **Inter** 400/500/600 | All UI, body, forms, labels |
| `font-mono` | **JetBrains Mono** 400/500 | Money, kWh, voltage, ledger rows, invoices |

**Pairing rule:** Manrope and Inter are close in width, so enforce the contrast — display is always **600+ and ≥20px**, body is always **400/500 and ≤16px**. Never set Manrope at body size; never set Inter as a page title.

Bangla content (host titles, mall names, Dhaka addresses) falls back to **Noto Sans Bengali**, already in the sans stack.

**Scale:** `text-display-lg` · `text-display` · `text-h1` · `text-h2` · `text-h3` · `text-body` · `text-caption` · `text-overline`

**Money and telemetry:** always through `<Money poisha={...} />` or the `.numeric` class (`font-mono tabular-nums`). Values arrive from the API as **integer poisha** — never format with `toFixed()` in a component.

---

## Shape, elevation, motion

- **Radius:** `rounded-sm` 6 · `rounded` 10 (inputs/buttons) · `rounded-lg` 14 (cards) · `rounded-xl` 20 (modals) · `rounded-full` (chips only)
- **Elevation:** `shadow-1` card · `shadow-2` dropdown · `shadow-3` modal · `shadow-glow-charge` mint ring
- **Motion:** `duration-fast` 120ms · `duration-base` 200ms · `duration-slow` 320ms. `prefers-reduced-motion` is respected globally in `globals.css`.

### The signature element: the Charge Pulse

`animate-charge-pulse` means exactly one thing: **energy is flowing right now.** Allowed in three places and nowhere else:

1. The `ACTIVE` booking status badge
2. `[SMR]` proximity ring when the driver crosses the 15 m geofence
3. `[MI]` live power chart cursor, ticking with each socket reading

If it appears on a marketing card or a hover state, it stops meaning anything.

### Optional: the cockpit panel

The live telemetry panel on the session screen may use `bg-surface-inverse text-ink-inverse` — a dark panel inside a light app. This is not dark mode; it is one existing token used as a background. Cut it if time is short.

---

## Accessibility floor

1. **Contrast 4.5:1 for text.** Mint on white fails at small sizes — `brand-primary` is a *background* or large-text colour. For mint-coloured body text use `text-ink-brand` (`#047857`).
2. **Never colour alone.** Every status chip carries its text label. Mint/amber is a common colour-blind confusion pair.
3. **Visible keyboard focus** is set globally in `globals.css`. Do not remove it.
4. **Reduced motion** is respected globally, including the pulse.

---

## Enforcement

`npm run check:tokens` fails a PR on: raw hex, `bg-[#...]`, default Tailwind palette classes, and `dark:` prefixes inside `frontend/src/{features,app,components}`. It is on the PR checklist.

Escape hatch for a genuine exception (map pin colours driven by data): add `// token-lint-ignore` on that line and explain it in the PR.
