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
- Create a store + a **Pro** product (monthly RM19; optional annual/lifetime).
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

## Notes
- Free stays 100% no-signup; none of this gates the design tool or basic tracking.
- Phase 1 (dynamic QR — editable destination) builds on this spine next.
