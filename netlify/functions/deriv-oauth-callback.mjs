import { TOKEN_URL, TX_COOKIE, assertSameOrigin, clearCookie, config, errorResponse, getCookie, json, redirect, safeReturnPath, seal, sessionCookie, tokenExchange, unseal, buildSession } from './_lib/apex.mjs';

export default async request => {
    const clear = clearCookie(TX_COOKIE, '/api');
    try {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { allow: 'GET' });
        const url = new URL(request.url);
        const tx = getCookie(request, TX_COOKIE);
        if (!tx) return redirect('/?auth_error=missing_transaction', 302, { 'set-cookie': clear });
        const transaction = unseal(tx);
        if (!transaction || Date.now() > Number(transaction.expiresAt)) return redirect('/?auth_error=expired_transaction', 302, { 'set-cookie': clear });
        const { clientId, clientSecret, redirectUri } = config();
        if (url.searchParams.get('state') !== transaction.state) return redirect('/?auth_error=state_mismatch', 302, { 'set-cookie': clear });
        const code = url.searchParams.get('code');
        if (!code) return redirect('/?auth_error=authorization_failed', 302, { 'set-cookie': clear });
        const params = {
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            code_verifier: transaction.verifier,
            redirect_uri: redirectUri,
        };
        if (clientSecret) params.client_secret = clientSecret;
        const tokenData = await tokenExchange(params);
        const grantedScopes = String(tokenData.scope || url.searchParams.get('scope') || 'trade').split(/\s+/).filter(Boolean);
        const session = buildSession(tokenData, grantedScopes);
        const returnPath = safeReturnPath(transaction.returnPath);
        const destination = new URL(returnPath, config().siteOrigin);
        destination.searchParams.set('auth', 'connected');
        return redirect(destination.toString(), 302, { 'set-cookie': [clear, sessionCookie(session)] });
    } catch (error) {
        return redirect('/?auth_error=oauth_failed', 302, { 'set-cookie': clear });
    }
};
