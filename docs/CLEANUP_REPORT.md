# Cleanup report

## Removed

- Browser Deriv OAuth callback parser, code exchange/refresh service, PKCE/session token helpers, and callback route.
- URL-token and classic authenticated WebSocket request path (`legacy-request.js`).
- Manual Deriv token setup page and the other three superseded setup pages/routes.
- Fake `fetch-deriv-commissions` function and both commission hooks/cards, including the unsupported 8% calculations.
- Browser rendering of stored personal API tokens; the migration wipes and drops `sites.deriv_api_token`.
- Hardcoded hostname-to-Deriv-application map.
- Google Drive OAuth token persistence (short-lived tokens are memory-only).
- The isolated 91-file `new-user-interface-main/digits-no-chart-app` experiment and its second browser-token OAuth stack.

## Retained and refactored

- Vite site manager, RSBuild/Blockly production runtime, Supabase owner auth, domain purchase, XML bots, support, and subscriptions.
- One-repository/many-sites GitHub publishing and per-site Netlify projects.
- Existing legacy configuration tables as a compatibility write/read layer while versioned `site_configurations` becomes authoritative.
- Public Options WebSocket and trading engine, now using account-specific OTP sockets for authenticated sessions.

## Not removed

- Historical database migrations: they are required to reproduce existing databases.
- `commissions` table: retained as historical commercial data but no longer presented as Deriv markup.
- Empty `repo-push-new-user-interface` gitlink: no files remain and no runtime references exist, but removing a malformed tracked gitlink requires an index-level repository maintenance change.
- Optional Express feature service: active source references exist; it needs a separate provider-consolidation decision.
