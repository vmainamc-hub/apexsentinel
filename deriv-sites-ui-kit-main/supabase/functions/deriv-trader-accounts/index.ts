import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { derivRequest } from '../_shared/deriv.ts';
import { correlationId, corsHeaders, json, resolveAllowedOrigin, safeError } from '../_shared/http.ts';
import { requireTraderSession } from '../_shared/trader-session.ts';

serve(async req => {
  const id = correlationId();
  const siteId = req.headers.get('x-reef-site-id');
  const origin = await resolveAllowedOrigin(req, siteId);
  if (req.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
  if (req.method !== 'GET') return json(safeError('method_not_allowed', 'Method not allowed', id), 405, origin);
  try {
    const context = await requireTraderSession(req);
    if (!context.session.token.scopes.includes('trade')) return json(safeError('scope_missing', 'Reconnect with trade permission to view Options accounts', id), 403, origin);
    const result = await derivRequest<{ data: Array<Record<string, unknown>> }>('/trading/v1/options/accounts', {
      accessToken: context.accessToken,
      appId: context.session.token.application.app_id,
    });
    const data = (Array.isArray(result.data) ? result.data : []).map(account => ({
      account_id: String(account.account_id || ''),
      account_type: account.account_type === 'real' ? 'real' : 'demo',
      balance: typeof account.balance === 'number' || typeof account.balance === 'string' ? account.balance : 0,
      currency: typeof account.currency === 'string' ? account.currency : '',
      group: typeof account.group === 'string' ? account.group : '',
      status: typeof account.status === 'string' ? account.status : '',
    })).filter(account => account.account_id);
    return json({ data, correlationId: id }, 200, origin);
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 502;
    const code = String((error as { code?: string }).code || 'accounts_unavailable');
    console.error('deriv-trader-accounts failed', { correlationId: id, code, status });
    return json(safeError(code, status === 401 ? 'Deriv session expired; reconnect your account' : 'Options accounts are temporarily unavailable', id), status, origin);
  }
});
