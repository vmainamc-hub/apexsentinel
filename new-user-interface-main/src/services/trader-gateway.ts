export type TraderSessionStatus = {
    authenticated: boolean;
    scopes: string[];
    expiresAt: string | null;
    csrfToken: string | null;
};

export type TraderAccount = {
    account_id: string;
    balance: number;
    currency: string;
    group: string;
    status: string;
    account_type: 'demo' | 'real' | string;
};

type GatewayResponse<T> = { data?: T; authorizationUrl?: string; error?: string };

export class TraderGatewayClient {
    constructor(private readonly baseUrl = '/api') {}

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const headers = new Headers(init.headers);
        headers.set('Accept', 'application/json');
        if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

        const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers,
            credentials: 'include',
        });
        const payload = (await response.json().catch(() => ({}))) as GatewayResponse<T> & Record<string, unknown>;
        if (!response.ok) {
            throw new Error(typeof payload.error === 'string' ? payload.error : `Trader gateway request failed (${response.status})`);
        }
        return payload as T;
    }

    async createAuthorization(scopes: string[], returnPath = '/') {
        return this.request<{ authorizationUrl: string }>('/deriv-oauth-start', {
            method: 'POST',
            body: JSON.stringify({ scopes, returnPath }),
        });
    }

    async session() {
        return this.request<TraderSessionStatus>('/deriv-trader-session');
    }

    async accounts() {
        return this.request<{ data: TraderAccount[] }>('/deriv-trader-accounts');
    }

    async websocketUrl(accountId: string) {
        const session = await this.session();
        if (!session.csrfToken) throw new Error('Trader session is not ready');
        return this.request<{ data: { url: string } }>('/deriv-trader-otp', {
            method: 'POST',
            headers: { 'X-CSRF-Token': session.csrfToken },
            body: JSON.stringify({ accountId }),
        });
    }

    async logout() {
        const session = await this.session();
        if (!session.csrfToken) return;
        await this.request('/deriv-trader-session', {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': session.csrfToken },
        });
    }
}
