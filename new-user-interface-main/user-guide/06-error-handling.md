# Error handling and recovery

## Browser behavior

The generated site displays safe messages and keeps provider details out of the UI. Gateway requests include credentials and use correlation IDs for support. The browser must never log, persist, or include reusable Deriv tokens in an error report.

Expected recoverable states include:

- no trader session: show Login and restart OAuth;
- expired or revoked session: clear local account display state and restart OAuth;
- unavailable accounts: retain the page shell and offer Retry;
- OTP failure: do not reuse an old URL; request a new OTP URL;
- WebSocket disconnect: reconnect through a newly requested OTP when authentication is required;
- unavailable public config: show a configuration error rather than silently selecting another customer's site.

## Server behavior

Edge Functions validate origin, tenant/site binding, CSRF, scope, token status, and provider response shape. Public responses contain a generic message and correlation ID. Detailed provider errors belong in server logs and deployment/audit records.

OAuth transactions are single-use and expire. Trader sessions store only a hash in the database, while Deriv tokens are encrypted with the server-only encryption key. Revocation and logout invalidate the session server-side.

## Publishing recovery

The wizard stores non-secret drafts locally when the browser is offline. When connectivity returns, it automatically saves and submits the pending publish request. A GitHub commit itself cannot be created while the device has no network access; the queued request runs after reconnection.

Publishing and deployment failures are recorded separately. Owners can retry a failed publish or restore a previous configuration version. A site is marked deployed only after Netlify reports success and its health check passes.

## Support checklist

Record the correlation ID, site ID, UTC time, deployment ID, and affected route. Never ask a trader or owner to send OAuth tokens, cookies, Supabase JWTs, GitHub private keys, or Netlify access tokens.
