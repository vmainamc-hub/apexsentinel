import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { audit, correlationId, corsHeaders, json, resolveAllowedOrigin, safeError, supabaseAdmin } from '../_shared/http.ts';
import { clearTraderCookie, requireTraderSession } from '../_shared/trader-session.ts';

serve(async req => {
  const id = correlationId();
  const siteId = req.headers.get('x-reef-site-id');
  const origin = await resolveAllowedOrigin(req, siteId);
  if (req.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
  if (!origin) return json(safeError('origin_denied', 'Origin is not allowed for this site', id), 403, null);
  try {
    if (req.method === 'GET') {
      const context = await requireTraderSession(req);
      return json({
        authenticated: true,
        siteId: context.session.site_id,
        scopes: context.session.token.scopes,
        expiresAt: context.session.expires_at,
        csrfToken: context.csrfToken,
        correlationId: id,
      }, 200, origin);
    }
    if (req.method === 'DELETE') {
      const context = await requireTraderSession(req, true);
      await supabaseAdmin().from('trader_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', context.session.id);
      await audit({ organisationId: context.session.organisation_id, siteId: context.session.site_id, actorType: 'trader', action: 'trader.session.revoked', provider: 'deriv', correlationId: id });
      return json({ authenticated: false, correlationId: id }, 200, origin, { 'Set-Cookie': clearTraderCookie() });
    }
    return json(safeError('method_not_allowed', 'Method not allowed', id), 405, origin);
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 401;
    const code = String((error as { code?: string }).code || 'not_authenticated');
    return json(safeError(code, error instanceof Error ? error.message : 'Trader session request failed', id), status, origin, status === 401 ? { 'Set-Cookie': clearTraderCookie() } : {});
  }
});

