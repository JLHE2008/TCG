# TCG Atlas — free daily market updater

This public repository runs the **Refresh Atlas market data** GitHub Actions workflow daily at 22:00 UTC (06:00 Malaysia). It runs independently of ChatGPT and ChatGPT Plus. No Render service, paid runner, action artifact, dependency cache, API subscription or Site credential is used.

Only public English/Japanese TCGCSV card identities, market quotes, source-dated FX and observations are saved here. Private wishlists, accounts and saved decks remain in the owner-private Atlas Site. Website hosting, graded PSA coverage, internal classification and tournament/deck discovery are separate from this market updater.

## Operation and recovery

Actions → Refresh Atlas market data → Run workflow starts a manual check. Scheduled jobs can be delayed or dropped by GitHub. GitHub can disable inactive public-repository schedules after 60 days; this workflow normally commits a daily check. Check Actions for failures and use Run workflow to retry. Atlas preserves its previous successful data if this feed is unavailable.

Both languages must finish before any new data is committed. Missing provider prices remain unpriced. Provider omissions retain the previous card with no asserted current quote. Exact printing variants and languages never borrow each other's prices. `data/manifest.json` reports sourceUpdated, checkedAt, counts and real observation dates. `data/daily/` retains each available original source-dated observation. Hash-addressed gzip blobs serve full catalogs and compact, gap-preserving price histories; no history is invented. A single Git commit publishes the complete feed. Ordinary refreshes never republish the website.

Daily comparisons require an observation on the exact comparison date. Currency conversion is source-dated FX, not another language's price. TCGCSV/TCGplayer quotes are market references, not guaranteed sale prices or future returns.

Source: https://tcgcsv.com/ . Free runner policy: https://docs.github.com/en/billing/concepts/product-billing/github-actions . Site connection: https://tcg-atlas.smokyoak.chatgpt.site .

The first run fetches directly from the public provider; it does not export private Site storage. Earlier observations remain private in the Site, which merges them with this public feed at read time.
