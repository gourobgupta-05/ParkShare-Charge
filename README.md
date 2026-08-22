# ParkShare & Charge

Hybrid P2P + commercial smart parking and EV charging marketplace for Dhaka.
**CSE471 System Analysis and Design** — 4-person group project.

> **ONE backend, ONE frontend.** This is not four apps. Every member's features are routers and components *inside* the same Express app and the same Next.js app, isolated by folder ownership. One Render service, one Vercel project.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · TailwindCSS · deployed to **Vercel** |
| Backend | Node.js · Express · Mongoose · Socket.IO · deployed to **Render** |
| Database | MongoDB Atlas (2dsphere geospatial index + ACID multi-document transactions) |
| Realtime | Socket.IO — `/iot` (simulated charging telemetry) and `/chat` (driver ↔ host) |

---

## Quick start (do this once)

```bash
# 1. clone
git clone <repo-url>
cd parkshare-charge

# 2. install everything (npm workspaces — installs backend + frontend together)
npm install

# 3. create your env files from the templates
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# 4. fill in backend/.env — minimum to boot:
#    MONGO_URI, MONGO_DB_NAME, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
#    (generate a secret: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

# 5. run both apps together
npm run dev
```

- API → http://localhost:5000 (health check: http://localhost:5000/api/health)
- Web → http://localhost:3000

Run them separately with `npm run dev:api` / `npm run dev:web`.

### MongoDB Atlas — required, not optional

Use the free **M0** tier. A local standalone `mongod` **cannot run transactions**, and the escrow and split-payout features both need them.

Everyone shares one cluster but **uses their own database name** so nobody wipes anyone else's data:

| Member | `MONGO_DB_NAME` |
|---|---|
| Tamal Deb Nath | `parkshare_tdn` |
| Gourob Gupta | `parkshare_gg` |
| Maidul Islam | `parkshare_mi` |
| S. Moontaha Rahman | `parkshare_smr` |
| Integration / demo | `parkshare_demo` |

Whitelist `0.0.0.0/0` in Atlas Network Access, or each member's IP.

---

## Folder map

```
parkshare-charge/
├── backend/                 ← ONE Express app (Render)
│   ├── server.js            🔒 entry point: http + socket.io
│   ├── app.js               🔒 express app, cors, json, error handler
│   ├── config/              🔒 env validation, mongoose connection
│   ├── shared/constants.js  🔒 ★ all enums, commission %, status theme
│   ├── models/              🔒 ★ every shared schema (see below)
│   ├── middleware/          🔒 auth.js (JWT + role guards), errorHandler, validate
│   ├── utils/               🔒 ApiError, asyncHandler, apiResponse, money, token
│   ├── controllers/         🔒 auth.controller.js (common workflows)
│   ├── routes/              🔒 index.js mounts all 19 routers ONCE
│   ├── realtime/            🔒 socket.io registry
│   └── modules/             ← YOUR WORK GOES HERE, one folder per feature
│       ├── geo-search/          [TDN]   ├── reviews/          [GG]
│       ├── property-filter/     [TDN]   ├── calendar/         [GG]
│       ├── escrow/             [TDN]   ├── tariff/           [GG]
│       ├── mall-hours/         [TDN]   ├── invoices/         [GG]
│       ├── navigation/         [MI]    ├── geofence/         [SMR]
│       ├── iot-grid/           [MI]    ├── host-verification/[SMR]
│       ├── chat/               [MI]    ├── payout/           [SMR]
│       └── promo/              [MI]    └── penalty/          [SMR]
│
├── frontend/                ← ONE Next.js app (Vercel)
│   ├── tailwind.config.js   🔒 ★ shared theme — DO NOT EDIT INDIVIDUALLY
│   └── src/
│       ├── app/             🔒 layout, landing, login, register, profile
│       ├── components/ui/   🔒 Button, Input, Card, StatusBadge, Money, Alert…
│       ├── components/ProtectedRoute.js  🔒
│       ├── context/AuthContext.js        🔒
│       ├── lib/api.js       🔒 the only API client
│       ├── lib/constants.js 🔒 mirror of backend/shared/constants.js
│       ├── config/nav/      one nav file per member
│       └── features/        ← YOUR WORK GOES HERE (same 16 folders)
│
├── docs/04-design-system.md   colour + type tokens, read before writing UI
└── scripts/check-tokens.mjs   CI guard against hardcoded colours
```

🔒 = **DO NOT EDIT AFTER INITIAL SETUP.** Owned by the repo initializer. Changing one is a `chore/contract/*` PR with 2 approvals.

---

## Shared models (already built — import, don't redefine)

```js
const { User, Driver, Host, Property, Booking, Session, Payment, Wallet, LedgerEntry } = require('../../models');
```

| Model | Notes |
|---|---|
| `User` | Base. `Driver` / `Host` / `Admin` are discriminators on `role` — one collection, one login. |
| `Host` | `location` has a **2dsphere index**. `verificationStatus`, `balancePoisha`, `avgRating`. |
| `Property` | The listed space. **2dsphere** on `location`, plus `availability[]`, `operatingHours`, `chargerSpec`. |
| `Booking` | **The integration bus.** All four members touch it — read anything, write only your own block. Read the header comment in `models/Booking.js` before touching it. |
| `Session` | One charging session: kWh, voltage, cost. |
| `Payment` | Escrow + settlement record per booking. |
| `Wallet` / `LedgerEntry` | Internal double-entry ledger. `LedgerEntry` is **append-only**. |

### Two rules that will save you a week

1. **GeoJSON is `[longitude, latitude]`** — not `[lat, lng]`. Reverse it and Dhaka lands in the Indian Ocean.
2. **All money is an integer in poisha.** ৳120.50 is `12050`. No floats. Use `utils/money.js` on the backend and `<Money poisha={...} />` on the frontend.

---

## What each member does next

Everyone works in exactly two folders: `backend/modules/<your-feature>/` and `frontend/src/features/<your-feature>/`. Every feature folder already has a stub router (returns `501`) and a README naming its owner.

### Tamal Deb Nath `[TDN]`
`geo-search` · `property-filter` · `escrow` · `mall-hours`
Start with **geo-search** (`$geoNear` on `Property.location`, radius 1–5 km). **Escrow is the project's critical path** — everything downstream waits on it, so build it early and have the group review it.

### Gourob Gupta `[GG]`
`reviews` · `calendar` · `tariff` · `invoices`
Start with **calendar/slot-locking** — it creates the `Booking` document everyone else depends on. The partial unique index in `models/Booking.js` already blocks double-booking at the database level; your service adds the overlap check on top.

### Maidul Islam `[MI]`
`navigation` · `iot-grid` · `chat` · `promo`
Start with **iot-grid** — it's fully standalone. `modules/iot-grid/iot.socket.js` and `modules/chat/chat.socket.js` are already registered in `realtime/index.js`; just fill in the handlers. Keep the Mapbox **server** token server-side; proxy Directions through your own route.

### S. Moontaha Rahman `[SMR]`
`geofence` · `host-verification` · `payout` · `penalty`
Start with **host-verification** — nothing blocks it. Don't wait for Tamal's escrow to build the payout ledger: seed a fake `Payment` document matching the schema and build against it, then swap the import when escrow merges.

**Penalty worker warning:** Render's free tier sleeps after ~15 minutes idle, so an in-process cron silently stops. Make the worker **catch-up capable** — on boot, scan for all overdue bookings since the last run rather than assuming it ticked every minute.

---

## Working in parallel without conflicts

```bash
git checkout dev
git pull --rebase origin dev
git checkout -b feat/tdn/geo-search      # feat/<initials>/<feature-slug>
# … build inside YOUR folders only …
npm run check:tokens                      # must pass
git push -u origin feat/tdn/geo-search    # open PR into dev
```

| Rule | Why |
|---|---|
| Branch prefix `feat/tdn/` · `feat/gg/` · `feat/mi/` · `feat/smr/` | Instantly readable history |
| **Never edit a 🔒 file** in a feature branch | That's the whole conflict-avoidance strategy |
| Rebase on `dev` daily | Small conflicts instead of enormous ones |
| Never hand-merge `package-lock.json` | `git checkout --theirs package-lock.json && npm install` |
| One feature per PR, under ~400 lines | Big PRs get rubber-stamped, and that's where demo bugs come from |
| Squash and merge | Readable history for the report |

Merge order matters. The critical path is **calendar → tariff → escrow → payout → invoice**. See the Phase 1 plan §5.3 for the full dependency wave chart.

---

## Design system

Read `docs/04-design-system.md` **before writing any UI**.

Short version: never type a colour, type a token. `bg-surface`, `text-ink`, `border-line`, `bg-brand-primary`, `bg-warning-subtle`. No raw hex, no `bg-[#10B981]`, no `bg-emerald-500`, no `dark:` variants — `npm run check:tokens` fails the PR on all four.

Render booking state with `<StatusBadge status={...} />` and money with `<Money poisha={...} />` so all four members' screens look like one product.

---

## Deployment

| | Setting |
|---|---|
| **Render** (backend) | Root `./` · Build `npm install` · Start `node backend/server.js` · add every `backend/.env` variable to the dashboard |
| **Vercel** (frontend) | Root `frontend` · Framework Next.js · add every `NEXT_PUBLIC_*` variable |

Deploy on **day 2**, while the app is empty and mistakes are cheap. Teams that leave deployment to the end lose their final week to CORS and cold starts.

Point UptimeRobot or cron-job.org at `GET /api/health` every 10 minutes so the free Render instance doesn't sleep — if it sleeps, the penalty cron stops firing and sockets drop.

---

## Scope decisions on record

| Decision | Reason |
|---|---|
| **Google Cloud Vision OCR removed** | No feature consumed a plate number. Replaced with a **signed QR entry pass** (JWT, 15-min TTL, host scans it) — cheaper and more secure. |
| **Escrow is an internal double-entry ledger** | No sandbox offers real marketplace split settlement. Both required ACID transactions are preserved: escrow hold `[TDN]` and 88/12 settlement `[SMR]`. |
| **bKash mocked** | Merchant approval takes weeks. Adapter written, credentials blank. |
| **SMS mocked** | Needs prepaid BDT credit. `MockSmsProvider` logs the OTP in dev. |
| **Mapbox, Atlas, Firebase are real** | All free tier, all self-signup. |

Every mocked service sits behind a provider interface selected by an env var (`SMS_PROVIDER`, `PUSH_PROVIDER`, `PAYMENT_PROVIDER`), so swapping in a real credential is a one-line change.

---

## Team

| Member | Module 1 | Module 2 | Module 3 |
|---|---|---|---|
| **Tamal Deb Nath** | Geospatial Search Matrix | Property Category Filter | Escrow System · Mall Hours Guard |
| **Gourob Gupta** | Feedback & Rating Matrix | Calendar & Slot Locking | BERC Tariff Calculator · PDF Invoices |
| **Maidul Islam** | Navigation Engine | IoT Power Grid Broker | P2P Chat · Promo Code Engine |
| **S. Moontaha Rahman** | Geofenced Check-In | Host Verification Pipeline | Split Payout Ledger · Penalty Worker |
