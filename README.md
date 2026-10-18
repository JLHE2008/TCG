# TCG Atlas daily data service

An independent Node 22 service for English and Japanese Pokémon TCG market catalogs and source-dated price history. It makes no ChatGPT calls and does not require a ChatGPT subscription. This repository hosts updater code only; it does not host the TCG Atlas website.

## Deploy on Render

Use **New → Blueprint**, select this repository, and use the root `render.yaml`. Review the selected workspace, compute plan, persistent disk and charges before deploying. The Blueprint uses Singapore, the `0.5c-512mb` compute plan, and a 2 GB persistent disk. Render generates the `ATLAS_DATA_KEY` secret. Keep it private.

The timer refreshes daily at **06:00 Asia/Kuala_Lumpur**, catches up on startup, and retries failed runs. Only a complete successful refresh of both languages advances the published data pointer. Unpriced entries remain in the catalog. Source omissions retain the previous card identity, with old quotes excluded from new current prices. Historical gaps are never invented.

## Verify and connect Atlas

`/health` is public and reports only process health. `/api/metadata`, `/api/catalog?source=market&language=en`, and `/api/history?language=en&id=t42404&variant=Holofoil&days=365` require `Authorization: Bearer <ATLAS_DATA_KEY>`. Verify saved counts and source dates before configuring Atlas with the server-only `ATLAS_DATA_URL` and secret `ATLAS_DATA_KEY`. Do not send Site bypass tokens, user accounts, wishlist data or private decks to this service.

Before cutover, migrate existing real observation files into the persistent disk's `history/` directory and merge the real dates in `history/dates.json`. Preserve the last successful Site snapshots and leave the old updater enabled until live readback passes. Site hosting, PSA coverage and player/deck updates remain separate.

## Local checks

From `services/atlas-refresh`, run `npm run check`. No dependencies are required. For local development, supply `ATLAS_DATA_KEY` with at least 32 random characters, a writable `DATA_DIR`, and `PORT` if desired. Never commit an environment file or secret.
