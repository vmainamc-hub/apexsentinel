import { decryptSecret, encryptSecret } from './crypto.ts';
import { supabaseAdmin } from './http.ts';

export const DERIV_AUTHORIZATION_URL = 'https://auth.deriv.com/oauth2/auth';
export const DERIV_TOKEN_URL = 'https://auth.deriv.com/oauth2/token';
export const DERIV_API_BASE_URL = 'https://api.derivws.com';
export const KNOWN_SCOPES = ['trade', 'account_manage', 'payment', 'application_read'] as const;

export type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

const parseError = async (response: Response) => {
  const body = await response.json().catch(() => ({}));
  const first = body?.errors?.[0];
  return {
    status: response.status,
    code: first?.code || body?.error || 'DerivRequestFailed',
    message: first?.message || body?.error_description || `Deriv request failed (${response.status})`,
  };
};

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const response = await fetch(DERIV_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  });
  if (!response.ok) throw Object.assign(new Error('Deriv token exchange failed'), await parseError(response));
  return await response.json();
}

export async function getValidAccessToken(record: {
  id: string;
  access_token_encrypted: string;
  refresh_token_encrypted?: string | null;
  expires_at: string;
  token_type: string;
  scopes: string[];
}, application: { oauth_client_id: string }, table: 'encrypted_token_records' | 'owner_deriv_connections' = 'encrypted_token_records'): Promise<string> {
  if (Date.parse(record.expires_at) > Date.now() + 60_000) return decryptSecret(record.access_token_encrypted);
  if (!record.refresh_token_encrypted) throw Object.assign(new Error('Deriv session expired'), { code: 'session_expired', status: 401 });

  const refreshToken = await decryptSecret(record.refresh_token_encrypted);
  const response = await fetch(DERIV_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: application.oauth_client_id }),
  });
  if (!response.ok) throw Object.assign(new Error('Deriv token refresh failed'), await parseError(response));
  const token: TokenResponse = await response.json();
  const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString();
  await supabaseAdmin().from(table).update({
    access_token_encrypted: await encryptSecret(token.access_token),
    refresh_token_encrypted: token.refresh_token ? await encryptSecret(token.refresh_token) : record.refresh_token_encrypted,
    token_type: token.token_type || 'Bearer',
    scopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : record.scopes,
    expires_at: expiresAt,
  }).eq('id', record.id);
  return token.access_token;
}

export async function derivRequest<T>(path: string, input: {
  accessToken: string;
  appId: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}): Promise<T> {
  const response = await fetch(`${DERIV_API_BASE_URL}${path}`, {
    method: input.method || 'GET',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Deriv-App-ID': input.appId,
      Accept: 'application/json',
      ...(input.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
  });
  if (!response.ok) throw Object.assign(new Error('Deriv API request failed'), await parseError(response));
  return await response.json();
}
