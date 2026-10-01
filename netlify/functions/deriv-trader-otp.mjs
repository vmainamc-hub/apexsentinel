import { assertSameOrigin, derivRequest, errorResponse, json, requireSession } from './_lib/apex.mjs';

export default async request => {
    try {
        if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { allow: 'POST' });
        assertSameOrigin(request);
        const { session, cookie } = await requireSession(request);
        if (!(session.scopes || []).includes('trade')) return json({ error: 'Trade permission required' }, 403);
        if (request.headers.get('x-csrf-token') !== session.csrfToken) return json({ error: 'CSRF validation failed' }, 403);
        const body = await request.json().catch(() => ({}));
        const accountId = String(body.accountId || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{6,32}$/.test(accountId)) return json({ error: 'Invalid account ID' }, 400);
        const accounts = await derivRequest('/trading/v1/options/accounts', { token: session.accessToken });
        const list = Array.isArray(accounts.data) ? accounts.data : accounts.data ? [accounts.data] : [];
        if (!list.some(account => String(account.account_id) === accountId)) return json({ error: 'Account is not available to this session' }, 403);
        const result = await derivRequest(`/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`, { token: session.accessToken, method: 'POST' });
        const wsUrl = result?.data?.url;
        if (typeof wsUrl !== 'string') return json({ error: 'Deriv did not return a WebSocket URL' }, 502);
        const parsed = new URL(wsUrl);
        if (parsed.protocol !== 'wss:' || parsed.hostname !== 'api.derivws.com' || !parsed.pathname.startsWith('/trading/v1/options/ws/')) {
            return json({ error: 'Invalid WebSocket URL returned by Deriv' }, 502);
        }
        return json({ data: { url: wsUrl } }, 200, cookie ? { 'set-cookie': cookie } : {});
    } catch (error) {
        return errorResponse(error);
    }
};
