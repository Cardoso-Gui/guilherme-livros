# Amazon click analytics backend

Deployed to the existing guilherme-livros project on 2026-10-25. No legacy payment tables, functions, Auth settings, credentials, storage or paid features were modified.

## Repository placement
- Copy `supabase/migrations/20261025005939_amazon_click_analytics.sql` into the repository migration directory. This exact migration is ALREADY applied remotely; do not run the duplicate schema.sql again.
- Copy `index.ts` and `handler.js` into `supabase/functions/amazon-click/`.
- Keep `handler.test.mjs` alongside handler.js or adjust its import.
- public-config.json contains public app keys only; never put a service-role key in website code.
- Gateway configuration must retain `verify_jwt = true` for amazon-click.

The local migration file was created using the CLI and renamed to the version actually applied by the MCP migration tool (20261025005939) after reconciling remote history.

## Contract
Tracking: POST the endpoint in public-config.json with JSON `{"book_slug":"noah"}` (also labirinto-verde, o-quinto-herdeiro), Content-Type application/json and Authorization Bearer ingestAnonKey. Use `credentials:"omit"`, `referrerPolicy:"no-referrer"`, `keepalive:true`. Do not block Amazon navigation or retry automatically. Successful records return 204; cap 429; invalid input 400; unavailable 503. Do not send visitor IDs, cookies, IPs, URL/query strings or user information.

The browser must explicitly omit credentials. The infrastructure can emit anti-bot Set-Cookie headers; fetch with credentials omit must not retain them. Supabase infrastructure still processes IPs and request metadata in its logs. Application code does not log these.

Dashboard: use url/publishableKey with normal Supabase Auth login. Call `rpc("analytics_is_owner")` after authenticated login; only true allows the panel. Query `amazon_click_daily` columns `book_slug,day,clicks`, filter by day and optional book. Day is a calendar date in America/Sao_Paulo, not UTC. RLS independently enforces authorization even if client UI is bypassed. Unauthenticated SELECT fails, other authenticated users see no rows. Do not use UI hiding as security. Distinguish zero clicks from missing authorization, offline/error states.

## Authorization
A separate runtime provisioning operation bound the user's explicitly confirmed, existing Auth UUID to analytics_private.readers; exactly one row exists. No account/password or global role was created. The migration intentionally does not seed a privileged identity. For another deployment, independently verify the owner identity, then add only that exact UUID through an authorized administrator. Never authorize arbitrary authenticated accounts or user_metadata values.

## Data and abuse limits
- Persistent aggregates: book_slug, Sao Paulo day, total accepted click events.
- Three rolling limiter rows max: book_slug, current minute, accepted count; no visitor identifiers.
- Atomic UPSERT serialized by per-book limiter row: max 120 accepted clicks per book per minute. Older delayed requests cannot reset a newer window.
- This is not unique-visitor measurement or purchase/conversion tracking. Anyone can copy a public key/origin. Caps limit stored inflation, NOT the number of Edge invocations. Legitimate clicks can be dropped at the cap; navigation remains available.
- No retention cleanup or scheduled jobs added.

## Costs and availability
The existing organization reports Free. Published limits at implementation: 500,000 Edge invocations, 500 MB database, 5 GB egress; these are shared with other usage as applicable. Remaining quota was not exposed/verified. No plan change/new provider/paid service was made. Free projects may pause after inactivity; tracking then fails open while Amazon links continue. Never promise unlimited or permanently free operation.
Sources: https://supabase.com/pricing ; https://supabase.com/docs/guides/functions/logging

## Verification
- Node handler tests: 4 suites passed; strict shape/slug validation, origin/method/type/body-size guards, accepted path, cap response and backend-failure behavior.
- Independent review found and fixed stale-minute limiter rollback before deployment.
- Database transactional assertions passed for 120 atomic increments, 121st refusal, invalid slug, stale-window rejection, new-minute reset, Sao Paulo midnight, synthetic non-owner denial, authorized reader access, no anonymous reads/direct public writes. All fixture changes rolled back.
- These role-context checks are SQL policy simulations; no login tokens, passwords or actual owner session were created/used.
- Live gateway OPTIONS returned 204 with correct CORS; anonymous read/RPC and missing JWT denied; invalid slug/extra fields and wrong origin rejected. See live-readonly-tests.json.
- After tests, actual daily count rows=0, limiter rows=0, reader rows=1.
- A live accepted-click request has deliberately not been sent, so real HTTP-to-database success and concurrent HTTP load remain unverified. Local handler acceptance and database increment were tested separately without contaminating statistics. User login must be completed by the owner.
- Advisor: intentional private locked limiter has RLS and no public policy; existing legacy test-table info and leaked-password warning remain. Password protection is not included in the verified Free plan.

Original broader fixture request expired at tool approval and was NOT treated as a passed test. Narrower no-delete rollback tests subsequently succeeded. No old data was touched.
