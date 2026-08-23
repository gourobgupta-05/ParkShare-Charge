# Gourob Gupta [GG] — module files

Unzip this **over your cloned repo root**. Every path matches the repo exactly,
so files land in place and overwrite the `501 Not Implemented` stubs.

## What's here

```
backend/modules/reviews/       Module 1 — Post-Session Feedback & Verification Matrix
backend/modules/calendar/      Module 2 — Live Calendar Scheduler & Slot Locking
backend/modules/tariff/        Module 3 — Dynamic BERC Electricity Tariff Calculator
backend/modules/invoices/      Module 3 — Automated PDF Invoice Engine with VAT

frontend/src/features/<same four>/   UI for each feature
frontend/src/app/bookings/           Bookings list + detail + invoice view
frontend/src/app/review/[bookingId]/ Leave a review
frontend/src/app/host/availability/  Weekly rules + blackout dates
frontend/src/app/host/reviews/       Host rating + replies
frontend/src/app/admin/tariffs/      BERC slabs + platform multiplier
frontend/src/app/space/[spaceId]/    Space detail + booking flow  (see note below)
frontend/src/config/nav/gourob.nav.js
```

## Push it

```bash
git checkout dev
git pull --rebase origin dev
git checkout -b feat/gg/module-1-2-3
# unzip over the repo root here
npm run check:tokens        # must pass before you commit
git add .
git commit -m "feat(gg): reviews, calendar slot-locking, BERC tariff, PDF invoices"
git push -u origin feat/gg/module-1-2-3
```

## ⚠️ One file needs the team's agreement: `app/space/[spaceId]/page.js`

This is a **shared composite screen**, not a GG-only page. Four of its five
panels are Gourob's (calendar, interval picker, tariff estimator, reviews);
`MallHoursNotice` is imported read-only from Tamal's folder.

It exists because Tamal's `SlotCard` links to `/space/[id]`, and without this
page the booking flow is unreachable. Flag it in the PR description so the team
knows it is a joint surface. If Tamal has already pushed his own version,
**keep his and drop this one** rather than overwriting.

## Shared-file changes already on `main`

Neither is in this zip — the repo owner merged both with the foundation:

1. `backend/package.json` — `pdfkit` dependency (the invoice engine needs it)
2. `backend/.env.example` — `CALENDAR_SLOT_MINUTES`, `CALENDAR_WORKER_ENABLED`,
   `CALENDAR_WORKER_INTERVAL_MS`

Run `npm install` after pulling if `pdfkit` is missing — the PDF route returns a
clear 503 rather than crashing if it isn't installed.

## Env values for `backend/.env`

```
SLOT_LOCK_TTL_SECONDS=600
MIN_BOOKING_MINUTES=30
MAX_BOOKING_HOURS=12
CALENDAR_SLOT_MINUTES=30
REVIEW_MIN_LENGTH=10
REVIEW_EDIT_WINDOW_HOURS=24
BERC_RATE_VERSION=2024-02
VAT_RATE=0.15
INVOICE_ISSUER_NAME=ParkShare & Charge Ltd.
INVOICE_SERIES_PREFIX=PSC
```

## Smoke test

```bash
npm run dev
curl http://localhost:5000/api/tariff/rates      # -> the 4 BERC slabs
```

Then seed spaces (Tamal's script) and open a space in the UI — seeded hosts are
available 24/7, so slots appear immediately.

## Two things that will bite you

1. **Slot locking and reviews both need MongoDB Atlas.** A standalone `mongod`
   cannot run transactions; both fail with a message saying exactly that.
2. **Booking creation runs Tamal's mall-hours guard as middleware.** If his
   module is still a stub on your branch, `require('../mall-hours/mallHoursGuard.middleware')`
   will fail. Rebase on `dev` after his PR merges, or temporarily comment that
   middleware out locally — never commit it commented.
