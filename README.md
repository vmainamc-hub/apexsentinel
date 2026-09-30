# Apex Sentinel

Standalone customer-facing Deriv trading website.

## Architecture

```
GitHub -> Netlify -> Apex Sentinel -> Deriv
```

There is no Supabase, Reef Sites control plane, tenant manager, site publisher, payment backend, or external authentication service in the runtime path.

## Customer workspace

The UI preserves the RiskManagers-style customer workflow and provides these eleven sections:

1. Dashboard
2. Bot Builder
3. Free Bots
4. DTrader
5. AI Bots
6. Auto Trades
7. Trading View
8. Copy Trading
9. Calculator
10. Analysis Tool
11. Digits Analysis

## Authentication

Deriv OAuth 2.0 Authorization Code + PKCE is handled by Netlify Functions. The browser receives only an opaque HttpOnly session cookie and non-secret session metadata. OAuth access/refresh tokens remain server-side in the encrypted session cookie.

Register this exact callback with the Deriv OAuth application:

`https://apexsentinell.netlify.app/api/deriv-oauth-callback`

Required Netlify variables:

- `APEX_DERIV_CLIENT_ID`
- `APEX_SITE_URL=https://apexsentinell.netlify.app`
- `APEX_SESSION_SECRET` (32+ random characters)
- `APEX_DERIV_CLIENT_SECRET` only when required by the registered Deriv client

Deriv documents OAuth 2.0 with `client_id`, PKCE, a registered redirect URI, and server-side code exchange.

## Local verification

```bash
npm install
npm run type-check
npm run test
npm run test:functions
npm run build
```

Netlify uses Node 20 and builds `new-user-interface-main/dist`.

## Deployment

Connect the repository to Netlify with the root `netlify.toml`. Set the four required environment variables before the first production OAuth test.
