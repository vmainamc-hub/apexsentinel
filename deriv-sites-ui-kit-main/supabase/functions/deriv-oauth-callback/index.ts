import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { decryptSecret, encryptSecret, randomSecret, sha256 } from '../_shared/crypto.ts';
import { exchangeAuthorizationCode } from '../_shared/deriv.ts';
import { audit, correlationId, safeError, supabaseAdmin } from '../_shared/http.ts';
import { traderCookie } from '../_shared/trader-session.ts';

const redirectWithError = (origin: string, path: string, code: string, id: string) => {
  const target = new URL(path, origin);
  target.searchParams.set('auth_error', code);
  target.searchParams.set('correlation_id', id);
  return Response.redirect(target.toString(), 302);
};

serve(async req => {
  const id = correlationId();
  const url = new URL(req.url);
  if (req.method !== 'GET') return new Response(JSON.stringify(safeError('method_not_allowed', 'Method not allowed', id)), { status: 405 });
  const state = url.searchParams.get('state');
  if (!state) return new Response(JSON.stringify(safeError('state_missing', 'OAuth state is missing', id)), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const admin = supabaseAdmin();
  const { data: transaction } = await admin
    .from('deriv_oauth_transactions')
    .select('*, application:deriv_applications(*)')
    .eq('state_hash', await sha256(state))
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!transaction?.application) return new Response(JSON.stringify(safeError('state_invalid', 'OAuth state is invalid, expired, or already used', id)), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const consumedAt = new Date().toISOString();
  const { data: consumed } = await admin
    .from('deriv_oauth_transactions')
    .update({ consumed_at: consumedAt })
    .eq('id', transaction.id)
    .is('consumed_at', null)
    .select('id');
  if (!consumed?.length) return redirectWithError(transaction.origin, transaction.return_path, 'callback_replayed', id);

  const oauthError = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const callbackActor = transaction.actor_type === 'platform_owner' ? 'platform_owner' : 'trader';
  if (oauthError || !code) {
    await audit({ organisationId: transaction.organisation_id, siteId: transaction.site_id, actorUserId: transaction.owner_user_id, actorType: callbackActor, action: `${transaction.actor_type}.oauth.denied`, provider: 'deriv', correlationId: id, metadata: { code: oauthError || 'code_missing' } });
    return redirectWithError(transaction.origin, transaction.return_path, oauthError ? 'login_cancelled' : 'code_missing', id);
  }

  try {
    const token = await exchangeAuthorizationCode({
      code,
      clientId: transaction.application.oauth_client_id,
      redirectUri: transaction.application.callback_uri,
      codeVerifier: await decryptSecret(transaction.code_verifier_encrypted),
    });
    if (!token.access_token) throw new Error('Token response did not include an access token');

    const grantedScopes = token.scope ? token.scope.split(/\s+/).filter(Boolean) : transaction.requested_scopes;
    const missing = transaction.requested_scopes.filter((scope: string) => !grantedScopes.includes(scope));
    if (missing.length > 0) {
      await audit({ organisationId: transaction.organisation_id, siteId: transaction.site_id, actorType: 'trader', action: 'trader.oauth.scope_missing', provider: 'deriv', correlationId: id, metadata: { missing } });
      return redirectWithError(transaction.origin, transaction.return_path, 'required_scope_missing', id);
    }

    const tokenExpiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString();
    const subjectHash = await sha256(token.refresh_token || token.access_token);
    if (transaction.actor_type === 'platform_owner' && transaction.owner_user_id) {
      const { error: ownerConnectionError } = await admin.from('owner_deriv_connections').upsert({
        organisation_id: transaction.organisation_id,
        site_id: transaction.site_id,
        deriv_application_id: transaction.deriv_application_id,
        owner_user_id: transaction.owner_user_id,
        subject_hash: subjectHash,
        access_token_encrypted: await encryptSecret(token.access_token),
        refresh_token_encrypted: token.refresh_token ? await encryptSecret(token.refresh_token) : null,
        token_type: token.token_type || 'Bearer',
        scopes: grantedScopes,
        expires_at: tokenExpiresAt,
        revoked_at: null,
        last_error_code: null,
      }, { onConflict: 'site_id' });
      if (ownerConnectionError) throw ownerConnectionError;
      await audit({ organisationId: transaction.organisation_id, siteId: transaction.site_id, actorUserId: transaction.owner_user_id, actorType: 'platform_owner', action: 'owner.deriv.connected', provider: 'deriv', correlationId: id, metadata: { scopes: grantedScopes } });
      const ownerTarget = new URL(transaction.return_path, transaction.origin);
      ownerTarget.searchParams.set('deriv_connection', 'connected');
      return Response.redirect(ownerTarget.toString(), 302);
    }

    const { data: tokenRecord, error: tokenError } = await admin.from('encrypted_token_records').upsert({
      organisation_id: transaction.organisation_id,
      site_id: transaction.site_id,
      deriv_application_id: transaction.deriv_application_id,
      subject_hash: subjectHash,
      access_token_encrypted: await encryptSecret(token.access_token),
      refresh_token_encrypted: token.refresh_token ? await encryptSecret(token.refresh_token) : null,
      token_type: token.token_type || 'Bearer',
      scopes: grantedScopes,
      expires_at: tokenExpiresAt,
      revoked_at: null,
    }, { onConflict: 'site_id,subject_hash' }).select('id').single();
    if (tokenError || !tokenRecord) throw tokenError || new Error('Token storage failed');

    const rawSession = randomSecret(48);
    const rawCsrf = randomSecret(32);
    const sessionSeconds = token.refresh_token ? 7 * 24 * 60 * 60 : Math.max(60, token.expires_in || 3600);
    const sessionExpiresAt = new Date(Date.now() + sessionSeconds * 1000).toISOString();
    const { error: sessionError } = await admin.from('trader_sessions').insert({
      session_hash: await sha256(rawSession),
      organisation_id: transaction.organisation_id,
      site_id: transaction.site_id,
      token_record_id: tokenRecord.id,
      origin: transaction.origin,
      csrf_hash: await sha256(rawCsrf),
      csrf_secret_encrypted: await encryptSecret(rawCsrf),
      expires_at: sessionExpiresAt,
    });
    if (sessionError) throw sessionError;

    await audit({ organisationId: transaction.organisation_id, siteId: transaction.site_id, actorType: 'trader', action: 'trader.oauth.completed', provider: 'deriv', correlationId: id, metadata: { scopes: grantedScopes } });
    const target = new URL(transaction.return_path, transaction.origin);
    target.searchParams.set('auth', 'connected');
    return new Response(null, {
      status: 302,
      headers: {
        Location: target.toString(),
        'Set-Cookie': traderCookie(rawSession, sessionSeconds),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('deriv-oauth-callback failed', { correlationId: id, error });
    await audit({ organisationId: transaction.organisation_id, siteId: transaction.site_id, actorUserId: transaction.owner_user_id, actorType: callbackActor, action: `${transaction.actor_type}.oauth.failed`, provider: 'deriv', correlationId: id });
    return redirectWithError(transaction.origin, transaction.return_path, 'token_exchange_failed', id);
  }
});
