import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { encryptSecret, randomSecret, sha256 } from '../_shared/crypto.ts';
import { DERIV_AUTHORIZATION_URL, KNOWN_SCOPES } from '../_shared/deriv.ts';
import { audit, correlationId, corsHeaders, json, resolveAllowedOrigin, safeError, supabaseAdmin } from '../_shared/http.ts';

serve(async req => {
  const id = correlationId();
  const origin = await resolveAllowedOrigin(req, null);
  if (req.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(safeError('method_not_allowed', 'Method not allowed', id), 405, origin);
  if (!origin) return json(safeError('origin_denied', 'Platform origin is not allowed', id), 403, null);
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) return json(safeError('not_authenticated', 'Platform login is required', id), 401, origin);
    const admin = supabaseAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
    if (authError || !auth.user) return json(safeError('not_authenticated', 'Platform session is invalid', id), 401, origin);

    const body = await req.json();
    const siteId = String(body.siteId || '');
    const requested = Array.isArray(body.scopes) ? [...new Set(body.scopes.map(String))] : ['application_read'];
    if (requested.some(scope => !KNOWN_SCOPES.includes(scope as typeof KNOWN_SCOPES[number]))) return json(safeError('invalid_scope', 'Requested scope is unsupported', id), 400, origin);
    const { data: site } = await admin.from('sites').select('id, organisation_id').eq('id', siteId).maybeSingle();
    if (!site) return json(safeError('site_missing', 'Site was not found', id), 404, origin);
    const { data: canConnect } = await admin.rpc('has_organisation_role', { _organisation_id: site.organisation_id, _user_id: auth.user.id, _roles: ['tenant_owner'] });
    if (!canConnect) return json(safeError('forbidden', 'Only a site owner can connect the reporting identity', id), 403, origin);
    const { data: application } = await admin.from('deriv_applications').select('*').eq('site_id', siteId).maybeSingle();
    if (!application) return json(safeError('deriv_app_missing', 'Configure the Deriv application first', id), 409, origin);
    const configured = new Set(application.configured_scopes || []);
    if (requested.some(scope => !configured.has(scope))) return json(safeError('scope_not_configured', 'Enable the requested application scope in the wizard first', id), 409, origin);

    const state = randomSecret(32);
    const verifier = randomSecret(64);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const returnPath = typeof body.returnPath === 'string' && /^\/(?!\/)[^\r\n]*$/.test(body.returnPath) ? body.returnPath : `/sites/${siteId}/wizard`;
    const { error } = await admin.from('deriv_oauth_transactions').insert({
      state_hash: await sha256(state), organisation_id: site.organisation_id, site_id: siteId,
      deriv_application_id: application.id, actor_type: 'platform_owner', owner_user_id: auth.user.id,
      origin, return_path: returnPath, code_verifier_encrypted: await encryptSecret(verifier),
      requested_scopes: requested, expires_at: expiresAt,
    });
    if (error) throw error;
    const oauthUrl = new URL(DERIV_AUTHORIZATION_URL);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('client_id', application.oauth_client_id);
    oauthUrl.searchParams.set('redirect_uri', application.callback_uri);
    oauthUrl.searchParams.set('scope', requested.join(' '));
    oauthUrl.searchParams.set('state', state);
    oauthUrl.searchParams.set('code_challenge', await sha256(verifier));
    oauthUrl.searchParams.set('code_challenge_method', 'S256');
    await audit({ organisationId: site.organisation_id, siteId, actorUserId: auth.user.id, actorType: 'platform_owner', action: 'owner.deriv.oauth_started', provider: 'deriv', correlationId: id, metadata: { scopes: requested } });
    return json({ authorizationUrl: oauthUrl.toString(), expiresAt, correlationId: id }, 200, origin);
  } catch (error) {
    console.error('deriv-owner-oauth-start failed', { correlationId: id, error });
    return json(safeError('oauth_start_failed', 'Unable to start the Deriv application connection', id), 500, origin);
  }
});
