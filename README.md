# Telegram Fresh Bot

Standalone Telegram bot for Encar fresh listings.

## Run

1. `npm install`
2. Copy `.env.example` to `.env`
3. Set `TELEGRAM_BOT_TOKEN`
4. Optionally set `ENCAR_PROXY_URL`
5. `npm start`

## Notes

- No Postgres is required.
- State is stored locally in `./data/state.json`.
- Fresh parsing runs continuously while at least one chat has parsing enabled.
- Default fresh-listing age is `7 days` (`TELEGRAM_FRESH_MAX_AGE_MS=604800000`).
- `TELEGRAM_FRESH_GROUP_CONCURRENCY` controls how many filters run in parallel. By default it stays at `3`.
- Detail fetching starts from `TELEGRAM_FRESH_DETAIL_CONCURRENCY` (default `4`), drops to `2` on `429`, and recovers gradually up to `6` after clean scans.
- If `ENCAR_PROXY_URL` is set, direct Encar blocks automatically fail over to the proxy route for list and detail requests.
- Fresh rules are fixed to:
  - views `<= 6`
  - calls `<= 3`
  - subscriptions `<= 3`
