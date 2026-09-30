import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { derivRequest, getValidAccessToken } from '../_shared/deriv.ts';
import { audit, correlationId, corsHeaders, json, resolveAllowedOrigin, safeError, supabaseAdmin } from '../_shared/http.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type OwnerConnection = {
  id: string;
  organisation_id: string;
  site_id: string;
  deriv_application_id: string;
  scopes: string[];
  application: { app_id: string; [key: string]: unknown };
  [key: string]: unknown;
};
const numberValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) if (typeof row[key] === 'number' && Number.isFinite(row[key])) return row[key] as number;
  return undefined;
};
const stringValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) if (typeof row[key] === 'string' && row[key]) return row[key] as string;
  return undefined;
};
const normalizedRows = (payload: unknown) => {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const rows = Array.isArray(source.data) ? source.data : [source.data].filter(Boolean);
  return rows.filter(row => row && typeof row === 'object').map(rowValue => {
    const row = rowValue as Record<string, unknown>;
    return {
      ...(stringValue(row, ['app_id', 'application_id']) ? { applicationId: stringValue(row, ['app_id', 'application_id']) } : {}),
      ...(stringValue(row, ['currency']) ? { currency: stringValue(row, ['currency']) } : {}),
      ...(numberValue(row, ['markup', 'markup_amount', 'total_markup']) !== undefined ? { markupAmount: numberValue(row, ['markup', 'markup_amount', 'total_markup']) } : {}),
      ...(numberValue(row, ['trade_count', 'trades', 'contracts']) !== undefined ? { tradeCount: numberValue(row, ['trade_count', 'trades', 'contracts']) } : {}),
      ...(numberValue(row, ['turnover', 'trade_volume', 'volume']) !== undefined ? { turnover: numberValue(row, ['turnover', 'trade_volume', 'volume']) } : {}),
      raw: row,
    };
  });
};

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
    const { data: auth } = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
    if (!auth.user) return json(safeError('not_authenticated', 'Platform session is invalid', id), 401, origin);
    const body = await req.json();
    const siteId = typeof body.siteId === 'string' ? body.siteId : null;
    const dateFrom = String(body.dateFrom || '');
    const dateTo = String(body.dateTo || '');
    const adminMode = body.adminMode === true;
    if (!DATE.test(dateFrom) || !DATE.test(dateTo) || dateFrom > dateTo) return json(safeError('date_invalid', 'Use a valid inclusive UTC date range', id), 400, origin);
    const days = (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000;
    if (days > 366) return json(safeError('date_range_too_large', 'Date range cannot exceed 366 days', id), 400, origin);

    let connections: OwnerConnection[] = [];
    if (adminMode) {
      const { data: canViewFinance } = await admin.rpc('has_platform_permission', { _user_id: auth.user.id, _permission: 'finance.read' });
      if (!canViewFinance) return json(safeError('forbidden', 'Finance read permission is required', id), 403, origin);
      const { data } = await admin.from('owner_deriv_connections').select('*, application:deriv_applications(*)').is('revoked_at', null);
      connections = (data || []) as unknown as OwnerConnection[];
    } else {
      if (!siteId) return json(safeError('site_required', 'Site is required', id), 400, origin);
      const { data: site } = await admin.from('sites').select('organisation_id').eq('id', siteId).maybeSingle();
      if (!site) return json(safeError('site_missing', 'Site was not found', id), 404, origin);
      const { data: member } = await admin.rpc('is_organisation_member', { _organisation_id: site.organisation_id, _user_id: auth.user.id });
      if (!member) return json(safeError('forbidden', 'You cannot view this site', id), 403, origin);
      const { data } = await admin.from('owner_deriv_connections').select('*, application:deriv_applications(*)').eq('site_id', siteId).eq('owner_user_id', auth.user.id).is('revoked_at', null);
      connections = (data || []) as unknown as OwnerConnection[];
    }
    if (!connections.length) return json(safeError('deriv_connection_required', 'Connect a Deriv identity with application_read permission', id), 409, origin);

    const records: unknown[] = [];
    const errors: Array<{ siteId: string; code: string }> = [];
    for (const connection of connections) {
      try {
        if (!connection.scopes?.includes('application_read')) throw Object.assign(new Error(), { code: 'scope_missing' });
        const accessToken = await getValidAccessToken(connection, connection.application, 'owner_deriv_connections');
        const payload = await derivRequest<unknown>(`/applications/v1/markup-statistics?date_from=${dateFrom}&date_to=${dateTo}`, { accessToken, appId: connection.application.app_id });
        const normalized = normalizedRows(payload);
        for (const row of normalized) {
          const snapshot = {
            organisation_id: connection.organisation_id, site_id: connection.site_id,
            deriv_application_id: connection.deriv_application_id, date_from: dateFrom, date_to: dateTo,
            currency: row.currency || 'UNSPECIFIED', markup_amount: row.markupAmount ?? null,
            trade_count: row.tradeCount ?? null, turnover: row.turnover ?? null,
            raw_payload: payload, raw_source_version: 'deriv-applications-v1', synchronized_at: new Date().toISOString(),
          };
          await admin.from('markup_statistic_snapshots').upsert(snapshot, { onConflict: 'deriv_application_id,date_from,date_to,currency' });
          records.push({ siteId: connection.site_id, derivApplicationId: connection.application.app_id, startDate: dateFrom, endDate: dateTo, ...row, raw: undefined, synchronizedAt: snapshot.synchronized_at });
        }
        await admin.from('owner_deriv_connections').update({ last_synchronized_at: new Date().toISOString(), last_error_code: null }).eq('id', connection.id);
      } catch (error) {
        const code = String((error as { code?: string }).code || 'markup_unavailable');
        errors.push({ siteId: connection.site_id, code });
        await admin.from('owner_deriv_connections').update({ last_error_code: code }).eq('id', connection.id);
      }
    }
    await audit({ actorUserId: auth.user.id, actorType: adminMode ? 'platform_admin' : 'platform_owner', action: 'markup.statistics.synchronized', provider: 'deriv', correlationId: id, metadata: { siteId, dateFrom, dateTo, recordCount: records.length, errorCount: errors.length } });
    return json({ records, errors, source: 'Deriv registered-application markup statistics', partnerCommissions: { available: false, reason: 'No approved Partner commission API is configured.' }, synchronizedAt: new Date().toISOString(), correlationId: id }, 200, origin);
  } catch (error) {
    console.error('fetch-markup-statistics failed', { correlationId: id, error });
    return json(safeError('markup_unavailable', 'Markup statistics are temporarily unavailable', id), 502, origin);
  }
});
