import crypto from 'node:crypto';
import { AUTH_URL, KNOWN_SCOPES, TX_COOKIE, TX_MAX_AGE, assertSameOrigin, config, cookie, errorResponse, json, pkceChallenge, randomVerifier, safeReturnPath, seal } from './_lib/apex.mjs';

export default async request => {
    try {
        if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { allow: 'POST' });
        assertSameOrigin(request);
        const body = await request.json().catch(() => ({}));
        const requestedScopes = Array.isArray(body.scopes) ? body.scopes : ['trade'];
        const scopes = requestedScopes.map(String);
        if (!scopes.length || scopes.length !== new Set(scopes).size || scopes.some(scope => !KNOWN_SCOPES.has(scope))) return json({ error: 'Invalid OAuth scopes' }, 400);
        const returnPath = safeReturnPath(body.returnPath);
        const { clientId, redirectUri } = config();
        const state = crypto.randomBytes(24).toString('hex');
        const verifier = randomVerifier();
        const transaction = seal({ state, verifier, scopes, returnPath, expiresAt: Date.now() + TX_MAX_AGE * 1000 });
        const auth = new URL(AUTH_URL);
        auth.searchParams.set('response_type', 'code');
        auth.searchParams.set('client_id', clientId);
        auth.searchParams.set('redirect_uri', redirectUri);
        auth.searchParams.set('scope', scopes.join(' '));
        auth.searchParams.set('state', state);
        auth.searchParams.set('code_challenge', pkceChallenge(verifier));
        auth.searchParams.set('code_challenge_method', 'S256');
        const txCookie = cookie(TX_COOKIE, transaction, TX_MAX_AGE, { path: '/api' });
        return json({ authorizationUrl: auth.toString() }, 200, { 'set-cookie': txCookie });
    } catch (error) {
        return errorResponse(error);
    }
};
