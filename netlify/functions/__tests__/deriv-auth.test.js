'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.SESSION_SECRET = crypto.randomBytes(32).toString('base64url');
process.env.DERIV_OAUTH_CLIENT_ID = 'client-123';
process.env.DERIV_APP_ID = '99999';
process.env.SITE_ORIGIN = 'https://apex.example';
process.env.CONTEXT = 'production';

const { handler } = require('../deriv-auth');
const H = { 'x-reef-site-id': 'apex-sentinel', origin: 'https://apex.example' };
const call = (route, opts = {}) => handler({
    httpMethod: opts.method || 'GET',
    rawUrl: `https://apex.example/api/deriv-${route}`,
    headers: { ...H, ...(opts.headers || {}) },
    queryStringParameters: opts.query || {},
    body: opts.body ? JSON.stringify(opts.body) : null,
});
const cookieOf = res => ((res.multiValueHeaders || {})['Set-Cookie'] || []).map(c => c.split(';')[0]);
const jar = res => cookieOf(res).join('; ');

const mockFetch = routes => { global.fetch = async (url, init) => {
    const key = Object.keys(routes).find(k => String(url).includes(k));
    if (!key) throw new Error(`unexpected fetch ${url}`);
    const r = routes[key](url, init);
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
}; };

const login = async () => {
    const start = await call('oauth-start', { method: 'POST', body: { scopes: ['trade'], returnPath: '/dtrader' } });
    assert.equal(start.statusCode, 200);
    const auth = new URL(JSON.parse(start.body).authorizationUrl);
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(auth.searchParams.get('redirect_uri'), 'https://apex.example/api/deriv-oauth-callback');
    let tokenBody;
    mockFetch({ '/oauth2/token': (u, i) => { tokenBody = new URLSearchParams(i.body); return { status: 200, body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'trade' } }; } });
    const cb = await call('oauth-callback', { query: { code: 'abc', state: auth.searchParams.get('state') }, headers: { cookie: jar(start) } });
    assert.equal(cb.statusCode, 302);
    assert.match(cb.headers.Location, /^https:\/\/apex\.example\/dtrader\?auth=connected/);
    assert.equal(crypto.createHash('sha256').update(tokenBody.get('code_verifier')).digest('base64url'), auth.searchParams.get('code_challenge'));
    const set = cb.multiValueHeaders['Set-Cookie'].find(c => c.startsWith('apex_trader_session='));
    assert.match(set, /HttpOnly; Secure; SameSite=Lax/);
    assert.ok(!set.includes('AT') || !decodeURIComponent(set).includes('"at"'), 'token must be sealed');
    return cookieOf(cb).find(c => c.startsWith('apex_trader_session='));
};

test('start rejects wrong site, bad origin, bad scope', async () => {
    assert.equal((await call('oauth-start', { method: 'POST', body: { scopes: ['trade'] }, headers: { 'x-reef-site-id': 'other' } })).statusCode, 400);
    assert.equal((await call('oauth-start', { method: 'POST', body: { scopes: ['trade'] }, headers: { origin: 'https://evil.example' } })).statusCode, 403);
    assert.equal((await call('oauth-start', { method: 'POST', body: { scopes: ['payment'] } })).statusCode, 409);
    assert.equal((await call('oauth-start', { method: 'POST', body: { scopes: ['nope'] } })).statusCode, 400);
});

test('callback rejects wrong state and replay without cookie', async () => {
    const start = await call('oauth-start', { method: 'POST', body: { scopes: ['trade'] } });
    assert.equal((await call('oauth-callback', { query: { code: 'x', state: 'wrong' }, headers: { cookie: jar(start) } })).statusCode, 400);
    assert.equal((await call('oauth-callback', { query: { code: 'x', state: 'wrong' } })).statusCode, 400);
});

test('full flow: session, accounts, csrf-protected otp and logout', async () => {
    const session = await login();
    const s = await call('trader-session', { headers: { cookie: session } });
    assert.equal(s.statusCode, 200);
    const csrf = JSON.parse(s.body).csrfToken;
    assert.ok(!s.body.includes('"AT"') && !s.body.includes('RT'));

    mockFetch({ '/options/accounts/CR1/otp': () => ({ status: 200, body: { data: { url: 'wss://api.derivws.com/trading/v1/options/ws/authenticated?otp=1' } } }),
                '/options/accounts': (u, i) => { assert.equal(i.headers['Deriv-App-ID'], '99999'); return { status: 200, body: { data: [{ account_id: 'CR1', account_type: 'real', balance: 5, currency: 'USD' }] } }; } });
    const acc = await call('trader-accounts', { headers: { cookie: session } });
    assert.equal(JSON.parse(acc.body).data[0].account_id, 'CR1');

    const noCsrf = await call('trader-otp', { method: 'POST', body: { accountId: 'CR1' }, headers: { cookie: session } });
    assert.equal(noCsrf.statusCode, 403);
    const denied = await call('trader-otp', { method: 'POST', body: { accountId: 'CR9' }, headers: { cookie: session, 'x-csrf-token': csrf } });
    assert.equal(denied.statusCode, 403);
    const ok = await call('trader-otp', { method: 'POST', body: { accountId: 'CR1' }, headers: { cookie: session, 'x-csrf-token': csrf } });
    assert.equal(ok.statusCode, 200);
    assert.match(JSON.parse(ok.body).data.url, /^wss:\/\/api\.derivws\.com\//);

    const out = await call('trader-session', { method: 'DELETE', headers: { cookie: session, 'x-csrf-token': csrf } });
    assert.equal(out.statusCode, 200);
    assert.match(out.multiValueHeaders['Set-Cookie'][0], /Max-Age=0/);
});

test('otp refuses a non-Deriv websocket host', async () => {
    const session = await login();
    const csrf = JSON.parse((await call('trader-session', { headers: { cookie: session } })).body).csrfToken;
    mockFetch({ '/otp': () => ({ status: 200, body: { data: { url: 'wss://evil.example/ws' } } }),
                '/options/accounts': () => ({ status: 200, body: { data: [{ account_id: 'CR1' }] } }) });
    const r = await call('trader-otp', { method: 'POST', body: { accountId: 'CR1' }, headers: { cookie: session, 'x-csrf-token': csrf } });
    assert.equal(r.statusCode, 502);
});

test('tampered or missing session cookie is rejected', async () => {
    assert.equal((await call('trader-session')).statusCode, 401);
    const session = await login();
    assert.equal((await call('trader-session', { headers: { cookie: session.slice(0, -3) + 'abc' } })).statusCode, 401);
});

test('expired access token is refreshed and cookie rotated', async () => {
    const lib = require('../../lib/deriv-session');
    const sealed = lib.seal({ at: 'old', rt: 'RT1', accessExp: new Date(Date.now() - 1000).toISOString(), sessionExp: new Date(Date.now() + 3600e3).toISOString(), scopes: ['trade'], csrf: 'c' });
    mockFetch({ '/oauth2/token': (u, i) => { assert.equal(new URLSearchParams(i.body).get('refresh_token'), 'RT1'); return { status: 200, body: { access_token: 'new', refresh_token: 'RT2', expires_in: 3600 } }; },
                '/options/accounts': (u, i) => { assert.equal(i.headers.Authorization, 'Bearer new'); return { status: 200, body: { data: [] } }; } });
    const r = await call('trader-accounts', { headers: { cookie: `apex_trader_session=${encodeURIComponent(sealed)}` } });
    assert.equal(r.statusCode, 200);
    assert.ok(r.multiValueHeaders['Set-Cookie'][0].startsWith('apex_trader_session='));