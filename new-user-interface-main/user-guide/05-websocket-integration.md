# WebSocket integration

Unauthenticated visitors use `wss://api.derivws.com/trading/v1/options/ws/public`.

For an authenticated trader, the server verifies the site-bound session and `trade` scope, confirms the chosen account belongs to the current Deriv account list, then calls the Options OTP endpoint. The browser connects immediately to the returned `wss://api.derivws.com` URL. It does not send an `authorize` request or possess the bearer token used to obtain the OTP.

Account switches request a fresh OTP URL and reconnect the managed socket. Logout revokes the server session and clears non-secret account metadata. Existing request correlation, reconnect handling, and subscription cleanup remain in the trading engine.
