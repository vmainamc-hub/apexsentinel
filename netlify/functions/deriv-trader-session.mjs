import { assertSameOrigin, clearCookie, errorResponse, json, requireSession, SESSION_COOKIE } from './_lib/apex.mjs';

export default async request => {
    try {
        if (request.method === 'GET') {
            const { session, cookie } = await requireSession(request);
            const headers = cookie ? { 'set-cookie': cookie } : {};
            return json({ authenticated: true, scopes: session.scopes || [], expiresAt: new Date(session.expiresAt).toISOString(), csrfToken: session.csrfToken }, 200, headers);
        }
        if (request.method === 'DELETE') {
            assertSameOrigin(request);
            const { session } = await requireSession(request);
            if (request.headers.get('x-csrf-token') !== session.csrfToken) return json({ error: 'CSRF validation failed' }, 403);
            return json({ ok: true }, 200, { 'set-cookie': clearCookie(SESSION_COOKIE) });
        }
        return json({ error: 'Method not allowed' }, 405, { allow: 'GET, DELETE' });
    } catch (error) {
        return errorResponse(error);
    }
};
