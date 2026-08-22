# Maidul Islam [MI] — module files

Unzip this **over your cloned repo root**. Every path matches the repo exactly,
so files land in place and overwrite the `501 Not Implemented` stubs.

## What's here

```
backend/modules/navigation/    Module 1 — Turn-by-Turn Smart In-App Navigation Engine
backend/modules/iot-grid/      Module 2 — Simulated IoT WebSocket Power Grid Broker
backend/modules/chat/          Module 3 — Live P2P Encrypted WebSocket Coordination Chat
backend/modules/promo/         Module 3 — Commercial Partner Mall Promo Code Engine

frontend/src/features/<same four>/    UI for each feature
frontend/src/app/navigate/[bookingId]/  Turn-by-turn screen
frontend/src/app/chat/                  Messages inbox
frontend/src/app/host/energy/           Host energy logs
frontend/src/app/admin/promos/          Promo campaign admin
frontend/src/config/nav/maidul.nav.js
```

## Push it

```bash
git checkout dev
git pull --rebase origin dev
git checkout -b feat/mi/module-1-2-3
# unzip over the repo root here
npm run check:tokens        # must pass before you commit
git add .
git commit -m "feat(mi): navigation engine, IoT power broker, encrypted chat, promo engine"
git push -u origin feat/mi/module-1-2-3
```

## Two socket files overwrite existing stubs — keep the export names

`backend/modules/iot-grid/iot.socket.js` and `backend/modules/chat/chat.socket.js`
replace the scaffold stubs. `backend/realtime/index.js` (a frozen shared file)
requires them by path and calls them by name:

```js
module.exports = function registerIotNamespace(nsp) { ... }
module.exports = function registerChatNamespace(nsp) { ... }
```

**Do not rename those exported functions.** If you do, the server crashes at
boot for all four of you. Everything else inside the two files is yours.

## Shared-file changes already on `main`

Both were merged by the repo owner with the foundation — neither is in this zip:

1. `frontend/src/lib/socket.js` — the shared socket.io client factory. Both of
   your realtime hooks import it via `@/lib/socket`. It is a 🔒 frozen file now.
2. `frontend/package.json` — `socket.io-client` and `mapbox-gl` are both pinned.

Run `npm install` after pulling if either is missing.

## Env values for `backend/.env`

```
NAV_PROFILE=driving-traffic
NAV_ETA_CACHE_TTL_SECONDS=60
MAPBOX_SERVER_TOKEN=              # optional — blank uses the simulated router

IOT_TICK_INTERVAL_MS=3000
IOT_SIM_SEED=471
IOT_MAX_KW=22
IOT_VOLTAGE_NOMINAL=220
IOT_FAULT_PROBABILITY=0.01
IOT_READING_RETENTION_HOURS=48

CHAT_MESSAGE_MAX_LENGTH=1000
CHAT_HISTORY_PAGE_SIZE=50
CHAT_ENCRYPTION_KEY=              # set a real one before deploying

PROMO_MAX_DISCOUNT_POISHA=50000
PROMO_CASE_SENSITIVE=false
```

Frontend `.env.local`: `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_NAV_REFRESH_MS`,
`NEXT_PUBLIC_IOT_CHART_WINDOW_SECONDS`, `NEXT_PUBLIC_CHAT_MAX_LENGTH`,
`NEXT_PUBLIC_PROMO_PLACEHOLDER`, and `NEXT_PUBLIC_MAPBOX_TOKEN` (optional).

## Smoke test

```bash
node backend/modules/promo/promo.seed.js    # JAMUNA20 + 3 more codes
npm run dev
curl http://localhost:5000/api/promo/active
```

## Four things that will bite you

1. **No Mapbox token is fine.** Routing silently falls back to the simulated
   router and the UI labels it "Simulated route". That is intended behaviour,
   not a bug — but do not claim live traffic routing in the demo without a token.

2. **Charging needs an ACTIVE booking.** `iot.service.js` refuses to meter
   anything else, because fabricated kWh would flow straight into Gourob's
   invoice. Until Moontaha's geofence check-in merges, flip a booking to
   `ACTIVE` directly in Atlas to demo telemetry.

3. **Chat encryption is at rest, not end-to-end.** The server holds the key.
   Say so plainly in the report — a database dump reveals nothing, which is the
   real threat, but claiming E2E would be false.

4. **`CHAT_ENCRYPTION_KEY` unset uses a development key** and logs a warning
   once. Messages still encrypt and decrypt; just set a real key before deploy.

## Promo writes `booking.promo` only

`applyCode` never touches `booking.pricing` — that field belongs to Gourob's
tariff engine. The frontend applies the code, then calls his `priceBooking` so
VAT is recomputed on the discounted subtotal. If his module is still a stub on
your branch, that re-price call fails silently and the fare shows undiscounted.
Rebase on `dev` after his PR merges.
