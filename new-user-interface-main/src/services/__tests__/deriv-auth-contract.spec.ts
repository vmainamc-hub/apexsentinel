import { missingScopes, requiredScopesForFeatures, TraderGatewayClient } from '@reef-sites/deriv-auth';

describe('Deriv scope registry', () => {
    it('deduplicates and minimizes scopes for enabled trader features', () => {
        expect(requiredScopesForFeatures(['public_market_data', 'account_list', 'options_trading'])).toEqual(['trade']);
        expect(requiredScopesForFeatures(['account_creation', 'options_trading'])).toEqual(['account_manage', 'trade']);
    });

    it('reports required scopes that were not granted', () => {
        expect(missingScopes(['trade'], ['trade', 'account_manage'])).toEqual(['account_manage']);
    });
});

describe('TraderGatewayClient', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchMock });
    });

    it('uses credentials and site binding without accepting a browser token', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ authorizationUrl: 'https://auth.deriv.com/oauth2/auth' }) });
        const client = new TraderGatewayClient('/api', 'site-a');
        await client.createAuthorization(['trade'], '/bot');
        expect(fetchMock).toHaveBeenCalledWith('/api/deriv-oauth-start', expect.objectContaining({
            method: 'POST',
            credentials: 'include',
            headers: expect.objectContaining({ 'X-Reef-Site-ID': 'site-a' }),
        }));
    });

    it('retrieves CSRF from the session before requesting an OTP URL', async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: true, siteId: 'site-a', scopes: ['trade'], csrfToken: 'csrf' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { url: 'wss://api.derivws.com/socket' } }) });
        const client = new TraderGatewayClient('/api', 'site-a');
        await client.websocketUrl('CR123');
        expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({ 'X-CSRF-Token': 'csrf' }));
    });
});
