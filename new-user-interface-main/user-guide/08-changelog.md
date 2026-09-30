# Migration changelog

## 2026-07-19

- Replaced URL-token/classic OAuth compatibility with a server-side OAuth 2.0 Authorization Code + PKCE BFF.
- Removed all Deriv bearer/refresh-token browser persistence and browser code exchange.
- Added site-bound opaque sessions, CSRF validation, scope-aware accounts/OTP calls, and same-origin Netlify BFF proxies.
- Replaced hardcoded domain application maps with versioned runtime configuration.
- Integrated the runtime with the multi-tenant template/feature/configuration registries.
