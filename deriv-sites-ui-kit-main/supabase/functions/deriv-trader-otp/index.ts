import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { derivRequest } from '../_shared/deriv.ts';
import { audit, correlationId, corsHeaders, json, resolveAllowedOrigin, safeError } from '../_shared/http.ts';
import { requireTraderSession } from '../_shared/trader-session.ts';

const ACCOUNT_ID = /^[A-Z0-9]{3,32}$/;

serve(async req => {
  const id = correlationId();
  const siteId = req.headers.get('x-reef-site-id');
  const origin = await resolveAllowedOrigin(req, siteId);
  if (req.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(safeError('method_not_allowed', 'Method not allowed', id), 405, origin);
  try {
    const context = await requireTraderSession(req, true);
    if (!context.session.token.scopes.includes('trade')) return json(safeError('scope_missing', 'Reconnect with trade permission to trade', id), 403, origin);
    const body = await req.json();
    const accountId = String(body.accountId || '').toUpperCase();
    if (!ACCOUNT_ID.test(accountId)) return json(safeError('account_invalid', 'Account identifier is invalid', id), 400, origin);

    const accounts = await derivRequest<{ data: Array<{ account_id: string }> }>('/trading/v1/options/accounts', {
      accessToken: context.accessToken,
      appId: context.session.token.application.app_id,
    });
    if (!accounts.data.some(account => account.account_id === accountId)) return json(safeError('account_denied', 'This account is not available in the current Deriv session', id), 403, origin);

    const result = await derivRequest<{ data: { url: string } }>(`/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`, {
      method: 'POST',
      accessToken: context.accessToken,
      appId: context.session.token.application.app_id,
    });
    const socketUrl = new URL(result.data.url);
    if (socketUrl.protocol !== 'wss:' || socketUrl.hostname !== 'api.derivws.com') {
      throw Object.assign(new Error('Deriv returned an invalid WebSocket endpoint'), { code: 'otp_endpoint_invalid', status: 502 });
    }
    await audit({ organisationId: context.session.organisation_id, siteId: context.session.site_id, actorType: 'trader', action: 'trader.websocket.otp_issued', provider: 'deriv', correlationId: id, metadata: { accountId } });
    return json({ data: { url: socketUrl.toString() }, correlationId: id }, 200, origin);
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 502;
    const code = String((error as { code?: string }).code || 'otp_unavailable');
    console.error('deriv-trader-otp failed', { correlationId: id, code, status });
    return json(safeError(code, status === 401 ? 'Deriv session expired; reconnect your account' : 'Unable to start the authenticated trading connection', id), status, origin);
  }
});
