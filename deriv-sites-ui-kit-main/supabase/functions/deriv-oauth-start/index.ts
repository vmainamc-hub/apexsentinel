import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { encryptSecret, randomSecret, sha256 } from '../_shared/crypto.ts';
import { DERIV_AUTHORIZATION_URL, KNOWN_SCOPES } from '../_shared/deriv.ts';
import { audit, correlationId, corsHeaders, json, resolveAllowedOrigin, safeError, supabaseAdmin } from '../_shared/http.ts';

const RETURN_PATH = /^\/(?!\/)[^\r\n]*$/;

serve(async req => {
  const id = correlationId();
  const headerSiteId = req.headers.get('x-reef-site-id');
  const origin = await resolveAllowedOrigin(req, headerSiteId);
  if (req.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(safeError('method_not_allowed', 'Method not allowed', id), 405, origin);
  if (!origin) return json(safeError('origin_denied', 'This origin is not registered for the site', id), 403, null);

  try {
    const body = await req.json();
    const siteId = String(body.siteId || headerSiteId || '');
    const returnPath = typeof body.returnPath === 'string' && RETURN_PATH.test(body.returnPath) ? body.returnPath : '/';
    if (!siteId || siteId !== headerSiteId) return json(safeError('site_mismatch', 'Site identifier is invalid', id), 400, origin);

    const requested = Array.isArray(body.scopes) ? [...new Set(body.scopes.map(String))] : [];
    if (requested.length === 0 || requested.some(scope => !KNOWN_SCOPES.includes(scope as typeof KNOWN_SCOPES[number]))) {
      return json(safeError('invalid_scope', 'At least one supported scope is required', id), 400, origin);
    }

    const admin = supabaseAdmin();
    const { data: site } = await admin
      .from('sites')
      .select('id, organisation_id, status, deployment_disabled')
      .eq('id', siteId)
      .eq('status', 'active')
      .maybeSingle();
    if (!site || site.deployment_disabled) return json(safeError('site_unavailable', 'This site is not available', id), 404, origin);

    const { data: application } = await admin
      .from('deriv_applications')
      .select('*')
      .eq('site_id', siteId)
      .in('verification_status', ['configured', 'verified'])
      .maybeSingle();
    if (!application) return json(safeError('deriv_app_missing', 'Deriv application configuration is incomplete', id), 409, origin);

    const allowedScopes = new Set(application.configured_scopes || []);
    if (requested.some(scope => !allowedScopes.has(scope))) {
      return json(safeError('scope_not_configured', 'A requested feature needs a scope not configured for this application', id), 409, origin);
    }

    const state = randomSecret(32);
    const verifier = randomSecret(64);
    const challenge = await sha256(verifier);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const { error: insertError } = await admin.from('deriv_oauth_transactions').insert({
      state_hash: await sha256(state),
      organisation_id: site.organisation_id,
      site_id: site.id,
      deriv_application_id: application.id,
      origin,
      return_path: returnPath,
      code_verifier_encrypted: await encryptSecret(verifier),
      requested_scopes: requested,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    const url = new URL(DERIV_AUTHORIZATION_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', application.oauth_client_id);
    url.searchParams.set('redirect_uri', application.callback_uri);
    url.searchParams.set('scope', requested.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    await audit({ organisationId: site.organisation_id, siteId, actorType: 'trader', action: 'trader.oauth.started', provider: 'deriv', correlationId: id, metadata: { scopes: requested } });
    return json({ authorizationUrl: url.toString(), expiresAt, correlationId: id }, 200, origin);
  } catch (error) {
    console.error('deriv-oauth-start failed', { correlationId: id, error });
    return json(safeError('oauth_start_failed', 'Unable to start Deriv login', id), 500, origin);
  }
});

