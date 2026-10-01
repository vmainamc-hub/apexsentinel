import assert from 'node:assert/strict';
import { cookie, getCookie, pkceChallenge, randomVerifier, seal, unseal, safeReturnPath } from '../functions/_lib/apex.mjs';

process.env.APEX_DERIV_CLIENT_ID = 'test-client';
process.env.APEX_SITE_URL = 'https://peppy-starship-b80f54.netlify.app';
process.env.APEX_SESSION_SECRET = 'a'.repeat(48);

const verifier = randomVerifier();
assert.ok(verifier.length >= 43 && verifier.length <= 128);
assert.match(pkceChallenge(verifier), /^[A-Za-z0-9_-]+$/);

const sealed = seal({ state: 'abc', returnPath: '/#dashboard', expiresAt: Date.now() + 1000 });
assert.deepEqual(unseal(sealed), { state: 'abc', returnPath: '/#dashboard', expiresAt: unseal(sealed).expiresAt });

const request = new Request('https://peppy-starship-b80f54.netlify.app/api/test', {
    headers: { cookie: cookie('apex_oauth_tx', sealed, 600, { path: '/api' }) },
});
assert.equal(getCookie(request, 'apex_oauth_tx'), sealed);
assert.equal(safeReturnPath('/dashboard#dtrader'), '/dashboard#dtrader');
assert.equal(safeReturnPath('https://evil.example'), '/');

console.log('Apex OAuth helper tests passed');
