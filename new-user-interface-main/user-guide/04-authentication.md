# Authentication

The generated trading runtime uses the central BFF described in [platform architecture](../../docs/ARCHITECTURE.md). Do not add Deriv token parsing, browser token exchange, manual token input, or local/session storage for bearer tokens.

Runtime code calls `DerivWSAccountsService`, which wraps `TraderGatewayClient`:

- `POST /api/deriv-oauth-start`: returns a Deriv authorization URL.
- `GET /api/deriv-trader-session`: returns non-secret session status and an in-memory CSRF token.
- `GET /api/deriv-trader-accounts`: returns allowlisted Options account metadata.
- `POST /api/deriv-trader-otp`: returns a validated short-lived Deriv WebSocket URL.
- `DELETE /api/deriv-trader-session`: revokes the opaque local session.

The callback is `https://<site-domain>/api/deriv-oauth-callback`. Netlify proxies it to the central function so the HttpOnly session cookie remains first-party. Platform-owner Supabase sessions are unrelated and are never accepted as trader sessions.
