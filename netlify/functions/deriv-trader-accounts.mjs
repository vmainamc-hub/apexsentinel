import { assertSameOrigin, errorResponse, json, requireSession } from './_lib/apex.mjs';

export default async request => {
    try {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { allow: 'GET' });
        assertSameOrigin(request);
        const { session, cookie } = await requireSession(request);
        if (!(session.scopes || []).includes('trade')) return json({ error: 'Trade permission required' }, 403);
        const result = await (await import('./_lib/apex.mjs')).derivRequest('/trading/v1/options/accounts', { token: session.accessToken });
        const raw = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
        const data = raw.map(account => ({
            account_id: String(account.account_id || ''),
            balance: Number(account.balance || 0),
            currency: String(account.currency || ''),
            group: String(account.group || ''),
            status: String(account.status || ''),
            account_type: String(account.account_type || ''),
        })).filter(account => account.account_id);
        return json({ data }, 200, cookie ? { 'set-cookie': cookie } : {});
    } catch (error) {
        return errorResponse(error);
    }
};
