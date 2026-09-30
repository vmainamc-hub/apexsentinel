# Reef Sites

Reef Sites is a multi-tenant control plane for configuring and deploying many Deriv-powered trading websites from one shared GitHub repository. It contains:

- `deriv-sites-ui-kit-main`: owner and staff site manager (React/Vite/Supabase).
- `new-user-interface-main`: generated trading-site runtime (React/RSBuild/Blockly).
- `packages/*`: shared contracts for scopes, templates, features, runtime config, and deployment providers.
- `deriv-sites-ui-kit-main/supabase`: database migrations and server-side integrations.

The generated runtime never receives a Deriv bearer or refresh token. OAuth state, PKCE, token exchange/refresh, account calls, and OTP requests run in Supabase Edge Functions. Each deployed site reaches those functions through its same-origin `/api` Netlify proxy and receives only an opaque HttpOnly session cookie.

## Local commands

Use Node 20.

```bash
npm install --ignore-scripts
npm run dev:admin
npm run dev:trading-web
npm run build:admin
npm run build:trading-web
```

The admin app defaults to Vite port 8080; the trading runtime defaults to port 5000. Local Supabase Edge Functions are expected at `127.0.0.1:54321` when testing the complete auth flow.

## Production workflow

1. An owner creates a tenant-owned site and completes the resumable 10-step wizard.
2. Feature selection produces the minimum Deriv scope set.
3. Publishing creates an atomic GitHub App commit under `sites/<site-id>/`.
4. Netlify detects the commit and only builds the affected site.
5. Signed webhooks update deployment/domain state and perform a health check.
6. Owners and authorized staff see deployment history, real Deriv markup, and audit-backed errors.

Start with [architecture](docs/ARCHITECTURE.md), [production setup](docs/SETUP_AND_OPERATIONS.md), [audit](docs/PLATFORM_AUDIT_2026-07-19.md), and [cleanup report](docs/CLEANUP_REPORT.md).
