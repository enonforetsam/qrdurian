# qrdurian Pro — go-live checklist (Phase 0)

The code is shipped. These are the one-time dashboard/CLI steps only Danial can do to make
Pro actually work in production. Until done, the site is harmless: the account button shows,
but sign-in emails won't send and checkout won't resolve.

## 1. Email sending (magic links)
```
cd ~/Desktop/Experiments/qrdurian/trace
npx wrangler email sending enable qrdurian.com   # onboard the sender domain
```
The worker sends from `hello@qrdurian.com`. Verify the domain in the Cloudflare dashboard
(Email → Email Sending) — add the DNS records it asks for. Until enabled, `env.EMAIL.send`
no-ops/fails and the magic link is only logged (dev).

## 2. Secrets
```
npx wrangler secret put SESSION_SECRET      # any long random string — signs login sessions
npx wrangler secret put LS_WEBHOOK_SECRET   # must match the LemonSqueezy webhook signing secret
```

## 3. LemonSqueezy product + webhook
- Create a store + a **Pro** product (monthly **US$5**; optional annual/lifetime). LemonSqueezy
  is USD-based and converts for buyers automatically. Keep the price in `index.html` (the
  `.price` text + the Upgrade button) in sync with the product.
- Copy the product's **checkout URL** → paste into `index.html` `LS_CHECKOUT`
  (and the customer-portal URL into `LS_PORTAL`).
- Add a webhook: URL `https://trace.qrdurian.com/api/ls/webhook`, events =
  subscription_created/updated/resumed/expired/cancelled + order_created. Set its signing
  secret to the same value as `LS_WEBHOOK_SECRET` above.
- In the product's checkout, pass the buyer email (the client already appends
  `?checkout[email]=`); make sure "user_email" is in the webhook payload (LS default).

## 4. Deploy + migrate
```
npx wrangler deploy
npx wrangler d1 execute qrdurian-trace --remote --file=schema.sql   # creates accounts/login_tokens (idempotent)
```
(The worker also lazy-creates the tables on first use, so the migrate is belt-and-braces.)

## 5. Smoke test (prod)
- qrdurian.com → account icon → enter your email → check inbox → tap link → lands signed in.
- LemonSqueezy **test mode** → buy Pro → webhook fires → account icon turns green, popover
  shows PRO. Cancel → reverts.

## 6. Custom domains (Pro, Phase 4) — optional, when you want it
A Pro user can set a short-link domain (e.g. `go.kedai.my`) in **My QRs → Custom domain**.
That stores the domain so their links read `go.kedai.my/r/abc`, but the host only *resolves*
once you point it at this worker via **Cloudflare for SaaS**:
- Cloudflare dashboard → the zone → SSL/TLS → Custom Hostnames (or the SaaS API) → add the
  customer hostname as a custom hostname targeting the `qrdurian-trace` worker's fallback origin.
- Until that's done, links still work on `trace.qrdurian.com`. Treat per-domain onboarding as
  a manual concierge step for the first Pro customers; automate via the CF API later.

## What's already built (code-complete, behind the spine)
- **Phase 1 — Dynamic QR:** signed-in users' tracked QRs are owned; Pro can edit a printed
  code's destination (`/api/link/update`) — no reprint.
- **Phase 2 — Dashboard + analytics:** "My QRs & links" lists owned codes with scans; Pro
  gets edit-destination + CSV export (`/api/link/export`).
- **Phase 3 — Bulk + limits:** Pro bulk-creates tracked links → CSV; free accounts capped at
  5 owned tracked QRs (`FREE_LINK_CAP`), Pro unlimited. (No watermark on free exports — kept
  clean on purpose, viral-first.)

## Notes
- Free stays 100% no-signup; none of this gates the design tool or basic tracking.
- All Pro checks are enforced server-side (402 pro_only / 403 not_owner); client UI is cosmetic.
