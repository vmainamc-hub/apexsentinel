# Apex Sentinel

Standalone Deriv trading-bot site (React/RSBuild/Blockly) with its own Netlify Functions auth gateway.

- `new-user-interface-main` — trading web app and Express/PostgreSQL backend (`backend/`).
- `netlify/functions` — same-origin Deriv OAuth2 (code + PKCE) gateway and `/api` proxy. Tokens live only in AES-GCM sealed HttpOnly cookies; the browser never receives a Deriv token.
- `new-user-interface-main/public/site.config.json` — runtime site config; `public/apex-sentinel/` — owned bot catalogue.
- `deriv-sites-ui-kit-main`, `packages/*` — inherited multi-tenant "Reef" platform sources. Not used at runtime by Apex Sentinel.

```bash
npm ci
npm run build:trading-web      # output: new-user-interface-main/dist
npm run test:functions         # auth gateway tests (node --test)
```

