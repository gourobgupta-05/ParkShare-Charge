# Tamal Deb Nath [TDN] — module files

Unzip this **over the top of your cloned repo root**. Every path here matches the
repo exactly, so files land in the right place and overwrite the `501` stubs.

```
backend/modules/geo-search/         Module 1 — Geospatial Search Matrix
backend/modules/property-filter/    Module 2 — Property Category Filter Toggle
backend/modules/escrow/             Module 3 — Tokenized Escrow (ACID txn #1)
backend/modules/mall-hours/         Module 3 — Mall Operating Hours Guard
frontend/src/features/<same four>/  UI for each
frontend/src/app/search/            Map dashboard
frontend/src/app/wallet/            Wallet + top-up
frontend/src/app/host/hours/        Host opening-hours editor
frontend/src/app/admin/disputes/    Admin escrow + refunds
frontend/src/config/nav/tamal.nav.js
```

## Push

```bash
git checkout dev
git pull --rebase origin dev
git checkout -b feat/tdn/module-1-2-3
# unzip over the repo root here
npm run check:tokens        # must pass
git add .
git commit -m "feat(tdn): geo-search, property filter, escrow, mall-hours guard"
git push -u origin feat/tdn/module-1-2-3
```

## Two shared-file changes already merged by the repo owner

Neither is in this zip; both are already on `main`:

1. `frontend/package.json` — `mapbox-gl` dependency (needed by MapCanvas)
2. `backend/.env.example` — `MALL_HOURS_WORKER_ENABLED`, `MALL_HOURS_WORKER_INTERVAL_MS`

Run `npm install` after pulling if `mapbox-gl` is missing.

## Env values you need in `backend/.env`

`GEO_SEARCH_MIN_RADIUS_KM=1`, `GEO_SEARCH_MAX_RADIUS_KM=5`, `PAYMENT_PROVIDER=mock`,
`ESCROW_HOLD_EXPIRY_MINUTES=10`, `MALL_HOURS_BUFFER_MINUTES=15`

In `frontend/.env.local`: `NEXT_PUBLIC_MAPBOX_TOKEN` (optional — the map falls
back to a labelled placeholder and the result list still works without it).

## Smoke test

```bash
node backend/modules/geo-search/geoSearch.seed.js   # 8 Dhaka spaces + verified demo host
npm run dev
curl "http://localhost:5000/api/geo/search?lat=23.8103&lng=90.4125&radiusKm=3"
```

If the search returns `[]`, hit `/api/geo/index-health` — it reports whether the
2dsphere index actually built.

**Escrow needs MongoDB Atlas.** A standalone `mongod` cannot run transactions and
the hold will fail with a clear message telling you so.
