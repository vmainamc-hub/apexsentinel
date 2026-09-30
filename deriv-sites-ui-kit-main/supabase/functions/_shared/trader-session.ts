import { decryptSecret, sha256 } from './crypto.ts';
import { getValidAccessToken } from './deriv.ts';
import { resolveAllowedOrigin, supabaseAdmin } from './http.ts';

const readCookie = (req: Request, name: string) => {
  const cookie = req.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
};

export const traderCookie = (value: string, maxAge: number) =>
  `reef_trader_session=${encodeURIComponent(value)}; Path=/api; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

export const clearTraderCookie = () =>
  'reef_trader_session=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax';

export async function requireTraderSession(req: Request, requireCsrf = false) {
  const siteId = req.headers.get('x-reef-site-id');
  if (!siteId) throw Object.assign(new Error('Site identifier is required'), { code: 'site_required', status: 400 });
  const origin = await resolveAllowedOrigin(req, siteId);
  if (!origin) throw Object.assign(new Error('Origin is not allowed for this site'), { code: 'origin_denied', status: 403 });
  const rawSession = readCookie(req, 'reef_trader_session');
  if (!rawSession) throw Object.assign(new Error('Trader authentication is required'), { code: 'not_authenticated', status: 401 });

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from('trader_sessions')
    .select('*, token:encrypted_token_records(*, application:deriv_applications(*)), site:sites(id, organisation_id, status, deployment_disabled)')
    .eq('session_hash', await sha256(rawSession))
    .eq('site_id', siteId)
    .eq('origin', origin)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!session || session.site?.status !== 'active' || session.site?.deployment_disabled || !session.token || session.token.revoked_at || !session.token.application) {
    throw Object.assign(new Error('Trader session is invalid or expired'), { code: 'session_expired', status: 401 });
  }
  if (requireCsrf) {
    const submitted = req.headers.get('x-csrf-token');
    if (!submitted || await sha256(submitted) !== session.csrf_hash) {
      throw Object.assign(new Error('CSRF validation failed'), { code: 'csrf_invalid', status: 403 });
    }
  }
  const accessToken = await getValidAccessToken(session.token, session.token.application);
  await admin.from('trader_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.id);
  return { origin, session, accessToken, csrfToken: await decryptSecret(session.csrf_secret_encrypted) };
}
