import assert from 'node:assert/strict';

process.env.APEX_DERIV_CLIENT_ID = 'test-client';
process.env.APEX_SITE_URL = 'https://peppy-starship-b80f54.netlify.app';
process.env.APEX_SESSION_SECRET = 'a'.repeat(48);

const { seal, TX_COOKIE, SESSION_COOKIE, cookie, json, redirect } = await import('../functions/_lib/apex.mjs');
const callback = (await import('../functions/deriv-oauth-callback.mjs')).default;
const session = (await import('../functions/deriv-trader-session.mjs')).default;
const start = (await import('../functions/deriv-oauth-start.mjs')).default;

// Helper: array Set-Cookie values must become separate header lines.
assert.equal(redirect('/', 302, { 'set-cookie': ['a=1', 'b=2'] }).headers.getSetCookie().length, 2);
assert.equal(json({}, 200, { 'set-cookie': ['a=1', 'b=2'] }).headers.getSetCookie().length, 2);

// OAuth start: PKCE S256 + state, sets the transaction cookie scoped to /api.
const startRes = await start(new Request('https://peppy-starship-b80f54.netlify.app/api/deriv-oauth-start', {
    method: 'POST',
    headers: { origin: 'https://peppy-starship-b80f54.netlify.app', 'content-type': 'application/json' },
    body: JSON.stringify({ scopes: ['trade'], returnPath: '/' }),
}));
assert.equal(startRes.status, 200);
const authUrl = new URL((await startRes.json()).authorizationUrl);
assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');
assert.ok(authUrl.searchParams.get('state'));
assert.match(startRes.headers.getSetCookie()[0], /apex_oauth_tx=.*HttpOnly/);

// Cross-site POST without Origin is rejected.
const cross = await start(new Request('https://peppy-starship-b80f54.netlify.app/api/deriv-oauth-start', {
    method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{}',
}));
assert.ok(cross.status >= 400);

// Callback: exchange mocked Deriv token endpoint; response must carry TWO cookies (clear tx + session).
globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'trade' }), { status: 200 });
const tx = seal({ state: 's1', verifier: 'v'.repeat(50), scopes: ['trade'], returnPath: '/', expiresAt: Date.now() + 60000 });
const cbRes = await callback(new Request('https://peppy-starship-b80f54.netlify.app/api/deriv-oauth-callback?code=abc&state=s1', {
    headers: { cookie: cookie(TX_COOKIE, tx, 600, { path: '/api' }) },
}));
assert.equal(cbRes.status, 302);
const cookies = cbRes.headers.getSetCookie();
assert.equal(cookies.length, 2, 'callback must emit two separate Set-Cookie headers');
assert.ok(cookies.some(c => c.startsWith(`${TX_COOKIE}=;`) || c.startsWith(`${TX_COOKIE}=`) && /Max-Age=0/.test(c)));
const sessionSetCookie = cookies.find(c => c.startsWith(`${SESSION_COOKIE}=`));
assert.ok(sessionSetCookie && /HttpOnly/.test(sessionSetCookie) && /Secure/.test(sessionSetCookie));

// The issued cookie authenticates the session endpoint.
const sessRes = await session(new Request('https://peppy-starship-b80f54.netlify.app/api/deriv-trader-session', {
    headers: { cookie: sessionSetCookie.split(';')[0] },
}));
assert.equal(sessRes.status, 200);
assert.equal((await sessRes.json()).authenticated, true);

// State mismatch is refused.
const bad = await callback(new Request('https://peppy-starship-b80f54.netlify.app/api/deriv-oauth-callback?code=abc&state=WRONG', {
    headers: { cookie: cookie(TX_COOKIE, tx, 600, { path: '/api' }) },
}));
assert.match(bad.headers.get('location'), /auth_error=state_mismatch/);

console.log('Apex handler cookie tests passed');
