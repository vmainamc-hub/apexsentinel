# Getting started

This directory is the generated trading-site runtime. Owners configure sites in the Reef Sites manager; they do not edit customer secrets or Deriv access tokens in this frontend.

## Requirements

- Node.js 20.x
- npm 9 or newer
- a published site configuration, or local runtime defaults for UI development

## Local development

```bash
npm install
npm start
```

The development server prints its local URL. For a production verification build, run:

```bash
npm run build
```

## Runtime flow

1. `src/main.tsx` loads the public site configuration before React renders.
2. The configuration selects branding, pages, navigation, tools, bots, public Deriv IDs, and the `/api` gateway.
3. Login starts at `/api/deriv-oauth-start`.
4. The server performs PKCE exchange and writes an opaque HttpOnly session cookie.
5. The browser requests account data and short-lived authenticated WebSocket URLs through the gateway; it never receives a reusable Deriv bearer token.

The public market socket remains browser-accessible because it needs no credential.

## Main directories

- `src/config`: runtime configuration loader and selectors
- `src/services`: browser-safe BFF clients
- `src/components/layout`: site shell and account controls
- `src/pages`: feature pages and bot builder
- `src/external/bot-skeleton`: inherited Blockly trading engine
- `scripts/netlify-ignore-site.js`: shared-repository build filter

## Deployment

Netlify builds this same template for every customer site. Each Netlify site receives its own `REEF_SITE_ID`; a commit under `sites/<site-id>/` triggers only that site's deployment. See the repository root `docs/SETUP_AND_OPERATIONS.md` for provider setup.

Do not add Deriv client secrets, GitHub credentials, Netlify tokens, service-role keys, or OAuth bearer tokens to browser environment variables.
