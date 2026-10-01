import crypto from 'node:crypto';

export const AUTH_URL = 'https://auth.deriv.com/oauth2/auth';
export const TOKEN_URL = 'https://auth.deriv.com/oauth2/token';
export const API_BASE = 'https://api.derivws.com';
export const SESSION_COOKIE = 'apex_trader_session';
export const TX_COOKIE = 'apex_oauth_tx';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const TX_MAX_AGE = 60 * 10;
export const KNOWN_SCOPES = new Set(['trade', 'account_manage', 'payment', 'application_read']);

const b64u = value => Buffer.from(value).toString('base64url');
const unb64u = value => Buffer.from(value, 'base64url');
const secretKey = () => crypto.createHash('sha256').update(process.env.APEX_SESSION_SECRET || '').digest();

export function config() {
    const clientId = process.env.APEX_DERIV_CLIENT_ID?.trim();
    const siteUrl = process.env.APEX_SITE_URL?.trim();
    const sessionSecret = process.env.APEX_SESSION_SECRET?.trim();
    if (!clientId || !siteUrl || !sessionSecret || sessionSecret.length < 32) throw new Error('Apex server configuration is incomplete');
    const url = new URL(siteUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('APEX_SITE_URL must use HTTPS');
    return {
        clientId,
        clientSecret: process.env.APEX_DERIV_CLIENT_SECRET?.trim() || '',
        siteOrigin: url.origin,
        redirectUri: new URL('/api/deriv-oauth-callback', url.origin).toString(),
    };
}

// A plain object (or array value) passed to `new Response` is flattened to ONE
// comma-joined Set-Cookie header, which browsers reject. Each cookie must be its
// own header line, so array values are appended individually.
export function buildHeaders(base = {}, extra = {}) {
    const headers = new Headers();
    for (const [name, value] of Object.entries({ ...base, ...extra })) {
        if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
        else if (value !== undefined && value !== null) headers.set(name, value);
    }
    return headers;
}

export function json(body, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: buildHeaders({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extraHeaders),
    });
}

export function redirect(url, status = 302, extraHeaders = {}) {
    return new Response(null, { status, headers: buildHeaders({ location: url }, extraHeaders) });
}

export function cookie(name, value, maxAge, { httpOnly = true, sameSite = 'Lax', path = '/', secure = true } = {}) {
    return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${path}; SameSite=${sameSite}${httpOnly ? '; HttpOnly' : ''}${secure ? '; Secure' : ''}`;
}

export const clearCookie = (name, path = '/') => cookie(name, '', 0, { path });

export function getCookie(request, name) {
    const raw = request.headers.get('cookie') || '';
    for (const part of raw.split(';')) {
        const [key, ...rest] = part.trim().split('=');
        if (key === name) return decodeURIComponent(rest.join('='));
    }
    return null;
}

export function seal(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [b64u(iv), b64u(ciphertext), b64u(cipher.getAuthTag())].join('.');
}

export function unseal(value) {
    const [ivPart, dataPart, tagPart] = String(value || '').split('.');
    if (!ivPart || !dataPart || !tagPart) throw new Error('Invalid sealed value');
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), unb64u(ivPart));
    decipher.setAuthTag(unb64u(tagPart));
    return JSON.parse(Buffer.concat([decipher.update(unb64u(dataPart)), decipher.final()]).toString('utf8'));
}

export function sameOrigin(request) {
    const origin = request.headers.get('origin');
    if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';
    return origin === config().siteOrigin;
}

export function assertSameOrigin(request) {
    if (!sameOrigin(request)) throw new Error('Cross-origin request rejected');
}

export function randomVerifier() {
    return b64u(crypto.randomBytes(48)).replace(/=+$/g, '');
}

export function pkceChallenge(verifier) {
    return b64u(crypto.createHash('sha256').update(verifier).digest()).replace(/=+$/g, '');
}

export function constantTimeEqual(a, b) {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function tokenExchange(params) {
    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams(params),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
        const error = new Error('Deriv OAuth token exchange failed');
        error.status = response.status || 502;
        throw error;
    }
    return data;
}

export async function derivRequest(path, { token, method = 'GET', body } = {}) {
    const headers = { authorization: `Bearer ${token}`, accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error('Deriv API request failed');
        error.status = response.status || 502;
        throw error;
    }
    return data;
}

export function buildSession(tokenData, scopes) {
    const now = Date.now();
    return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt: now + Number(tokenData.expires_in || 3600) * 1000,
        scopes,
        csrfToken: b64u(crypto.randomBytes(32)),
        sessionExpiresAt: now + SESSION_MAX_AGE * 1000,
    };
}

export async function refreshSession(session) {
    if (!session.refreshToken) return session;
    const { clientId, clientSecret } = config();
    const params = {
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: session.refreshToken,
    };
    if (clientSecret) params.client_secret = clientSecret;
    const tokenData = await tokenExchange(params);
    return {
        ...session,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || session.refreshToken,
        expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
    };
}

export async function requireSession(request) {
    const raw = getCookie(request, SESSION_COOKIE);
    if (!raw) throw Object.assign(new Error('Authentication required'), { status: 401 });
    let session;
    try { session = unseal(raw); } catch { throw Object.assign(new Error('Invalid session'), { status: 401 }); }
    if (!session?.accessToken || Date.now() >= Number(session.sessionExpiresAt || 0)) {
        throw Object.assign(new Error('Session expired'), { status: 401 });
    }
    if (Date.now() + 120000 < Number(session.expiresAt || 0)) return { session, cookie: null };
    try {
        const refreshed = await refreshSession(session);
        return { session: refreshed, cookie: cookie(SESSION_COOKIE, seal(refreshed), SESSION_MAX_AGE) };
    } catch {
        throw Object.assign(new Error('Deriv session expired'), { status: 401 });
    }
}

export function sessionCookie(session) {
    const value = seal(session);
    if (value.length > 3600) throw Object.assign(new Error('Session payload too large'), { status: 500 });
    return cookie(SESSION_COOKIE, value, SESSION_MAX_AGE);
}

export function errorResponse(error) {
    const status = Number(error?.status) || 500;
    return json({ error: status === 401 ? 'Authentication required' : 'Request failed' }, status);
}

export function safeReturnPath(value) {
    if (typeof value !== 'string' || !/^\/(?!\/)[^\r\n]*$/.test(value)) return '/';
    return value.slice(0, 500);
}
