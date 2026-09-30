-- Multi-tenant platform, versioned configuration, OAuth BFF, RBAC and reporting.
-- This migration is additive so existing sites continue to operate during migration.

CREATE TYPE public.platform_role AS ENUM (
  'super_admin',
  'operations_admin',
  'support_admin',
  'finance_viewer',
  'tenant_owner',
  'tenant_developer',
  'tenant_viewer'
);

CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.platform_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, user_id)
);

ALTER TABLE public.sites
  ADD COLUMN organisation_id UUID REFERENCES public.organisations(id) ON DELETE RESTRICT,
  ADD COLUMN internal_name TEXT,
  ADD COLUMN description TEXT,
  ADD COLUMN default_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN target_region TEXT,
  ADD COLUMN configuration_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (configuration_status IN ('draft', 'validating', 'ready', 'published', 'invalid')),
  ADD COLUMN active_configuration_version INTEGER,
  ADD COLUMN active_template_version TEXT,
  ADD COLUMN deployment_disabled BOOLEAN NOT NULL DEFAULT false;

-- One personal organisation per existing owner. The user-id suffix makes the slug stable and unique.
INSERT INTO public.organisations (name, slug, owner_user_id)
SELECT
  COALESCE(NULLIF(p.display_name, ''), split_part(p.email, '@', 1), 'Site owner') || '''s sites',
  'owner-' || replace(s.user_id::text, '-', ''),
  s.user_id
FROM (SELECT DISTINCT user_id FROM public.sites) s
LEFT JOIN public.profiles p ON p.id = s.user_id
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organisation_members (organisation_id, user_id, role)
SELECT o.id, o.owner_user_id, 'tenant_owner'::public.platform_role
FROM public.organisations o
ON CONFLICT (organisation_id, user_id) DO NOTHING;

UPDATE public.sites s
SET organisation_id = o.id
FROM public.organisations o
WHERE o.owner_user_id = s.user_id
  AND s.organisation_id IS NULL;

ALTER TABLE public.sites ALTER COLUMN organisation_id SET NOT NULL;
-- Personal Deriv API tokens are no longer supported or readable by the site manager.
UPDATE public.sites SET deriv_api_token = NULL WHERE deriv_api_token IS NOT NULL;
ALTER TABLE public.sites DROP COLUMN deriv_api_token;
CREATE INDEX idx_sites_organisation ON public.sites(organisation_id);
CREATE INDEX idx_organisation_members_user ON public.organisation_members(user_id, organisation_id);

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.organisation_members
      WHERE user_id = _user_id
        AND role = 'super_admin'
        AND status = 'active'
    )
$$;

CREATE OR REPLACE FUNCTION public.has_platform_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.organisation_members
      WHERE user_id = _user_id
        AND status = 'active'
        AND (
          role = 'super_admin'
          OR (role = 'operations_admin' AND _permission = ANY(ARRAY['admin.access','sites.read','sites.write','deployments.read','deployments.write','templates.write','features.write','notices.write']))
          OR (role = 'support_admin' AND _permission = ANY(ARRAY['admin.access','sites.read','support.read','support.write']))
          OR (role = 'finance_viewer' AND _permission = ANY(ARRAY['admin.access','sites.read','finance.read']))
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.is_organisation_member(_organisation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE organisation_id = _organisation_id AND user_id = _user_id AND status = 'active'
  ) OR public.is_platform_admin(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_organisation_role(
  _organisation_id UUID,
  _user_id UUID,
  _roles public.platform_role[]
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE organisation_id = _organisation_id
      AND user_id = _user_id
      AND role = ANY(_roles)
      AND status = 'active'
  ) OR public.is_platform_admin(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.create_personal_organisation(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id UUID;
  safe_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  safe_name := left(trim(_name), 120);
  IF char_length(safe_name) < 2 THEN RAISE EXCEPTION 'Organisation name is too short'; END IF;

  INSERT INTO public.organisations (name, slug, owner_user_id)
  VALUES (safe_name, 'org-' || replace(gen_random_uuid()::text, '-', ''), auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (new_id, auth.uid(), 'tenant_owner');
  RETURN new_id;
END;
$$;

CREATE TABLE public.templates (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]*$'),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  release_status TEXT NOT NULL DEFAULT 'draft' CHECK (release_status IN ('draft', 'approved', 'deprecated', 'disabled')),
  current_version TEXT NOT NULL,
  preview_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  runtime_package TEXT NOT NULL,
  supported_trade_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_scopes TEXT[] NOT NULL DEFAULT '{}',
  optional_features TEXT[] NOT NULL DEFAULT '{}',
  compatibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  migration_notes TEXT,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE public.feature_definitions (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required_scopes TEXT[] NOT NULL DEFAULT '{}',
  required_capabilities TEXT[] NOT NULL DEFAULT '{}',
  supported_api TEXT,
  release_status TEXT NOT NULL DEFAULT 'ready' CHECK (release_status IN ('ready', 'experimental', 'deprecated', 'disabled')),
  configuration_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.site_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  template_id TEXT NOT NULL REFERENCES public.templates(id),
  template_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validating', 'valid', 'invalid', 'published', 'archived')),
  wizard_step SMALLINT NOT NULL DEFAULT 1 CHECK (wizard_step BETWEEN 1 AND 10),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_result JSONB NOT NULL DEFAULT '{"blocking":[],"warnings":[]}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, version),
  FOREIGN KEY (template_id, template_version) REFERENCES public.template_versions(template_id, version)
);

CREATE TABLE public.deriv_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  oauth_client_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('staging', 'production')),
  callback_uri TEXT NOT NULL,
  configured_scopes TEXT[] NOT NULL DEFAULT '{}',
  markup_rate NUMERIC(8,4),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'configured', 'verified', 'invalid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id)
);

-- One-time PKCE records. Service-role only: no browser RLS policies are created.
CREATE TABLE public.deriv_oauth_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash TEXT NOT NULL UNIQUE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  deriv_application_id UUID NOT NULL REFERENCES public.deriv_applications(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL DEFAULT 'trader' CHECK (actor_type IN ('trader', 'platform_owner')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/',
  code_verifier_encrypted TEXT NOT NULL,
  requested_scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.owner_deriv_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  deriv_application_id UUID NOT NULL REFERENCES public.deriv_applications(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_hash TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_synchronized_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id)
);

-- Encrypted token material is deliberately separated from browser-readable connection metadata.
CREATE TABLE public.encrypted_token_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  deriv_application_id UUID NOT NULL REFERENCES public.deriv_applications(id) ON DELETE CASCADE,
  subject_hash TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, subject_hash)
);

CREATE TABLE public.trader_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash TEXT NOT NULL UNIQUE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  token_record_id UUID NOT NULL REFERENCES public.encrypted_token_records(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  csrf_hash TEXT NOT NULL,
  csrf_secret_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.markup_statistic_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  deriv_application_id UUID NOT NULL REFERENCES public.deriv_applications(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UNSPECIFIED',
  markup_amount NUMERIC,
  trade_count BIGINT,
  turnover NUMERIC,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_source_version TEXT NOT NULL DEFAULT 'deriv-applications-v1',
  synchronized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deriv_application_id, date_from, date_to, currency)
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('platform_owner', 'platform_admin', 'trader', 'system', 'provider')),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  provider TEXT,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ip_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.system_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'owners', 'admins')),
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  deployment_id UUID NOT NULL REFERENCES public.site_deployments(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  provider TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.site_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES public.site_deployments(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  http_status INTEGER,
  latency_ms INTEGER,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_code TEXT
);

CREATE INDEX idx_oauth_transactions_expiry ON public.deriv_oauth_transactions(expires_at) WHERE consumed_at IS NULL;
CREATE INDEX idx_trader_sessions_lookup ON public.trader_sessions(session_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_token_records_site ON public.encrypted_token_records(site_id, subject_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_configurations_site_status ON public.site_configurations(site_id, status, version DESC);
CREATE INDEX idx_markup_org_dates ON public.markup_statistic_snapshots(organisation_id, date_from, date_to);
CREATE INDEX idx_audit_org_created ON public.audit_logs(organisation_id, created_at DESC);
CREATE INDEX idx_deployment_logs_deployment ON public.deployment_logs(deployment_id, created_at);

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deriv_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deriv_oauth_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_deriv_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_token_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trader_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markup_statistic_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view organisations" ON public.organisations FOR SELECT TO authenticated
USING (public.is_organisation_member(id, auth.uid()));
CREATE POLICY "Owners update organisations" ON public.organisations FOR UPDATE TO authenticated
USING (public.has_organisation_role(id, auth.uid(), ARRAY['tenant_owner']::public.platform_role[]))
WITH CHECK (public.has_organisation_role(id, auth.uid(), ARRAY['tenant_owner']::public.platform_role[]));

CREATE POLICY "Members view memberships" ON public.organisation_members FOR SELECT TO authenticated
USING (public.is_organisation_member(organisation_id, auth.uid()));
CREATE POLICY "Owners manage memberships" ON public.organisation_members FOR ALL TO authenticated
USING (public.has_organisation_role(organisation_id, auth.uid(), ARRAY['tenant_owner']::public.platform_role[]))
WITH CHECK (public.has_organisation_role(organisation_id, auth.uid(), ARRAY['tenant_owner']::public.platform_role[]));

CREATE POLICY "Authenticated view approved templates" ON public.templates FOR SELECT TO authenticated
USING (release_status = 'approved' OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Authenticated view released template versions" ON public.template_versions FOR SELECT TO authenticated
USING (released_at IS NOT NULL OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Authenticated view ready features" ON public.feature_definitions FOR SELECT TO authenticated
USING (release_status IN ('ready', 'experimental') OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Members view configurations" ON public.site_configurations FOR SELECT TO authenticated
USING (public.is_organisation_member(organisation_id, auth.uid()));
CREATE POLICY "Editors insert configurations" ON public.site_configurations FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND public.has_organisation_role(
    organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[]
  )
);
CREATE POLICY "Editors update draft configurations" ON public.site_configurations FOR UPDATE TO authenticated
USING (
  status IN ('draft','validating','invalid','valid') AND public.has_organisation_role(
    organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[]
  )
)
WITH CHECK (public.is_organisation_member(organisation_id, auth.uid()));

CREATE POLICY "Members view Deriv application metadata" ON public.deriv_applications FOR SELECT TO authenticated
USING (public.is_organisation_member(organisation_id, auth.uid()));
CREATE POLICY "Owners manage Deriv application metadata" ON public.deriv_applications FOR ALL TO authenticated
USING (public.has_organisation_role(organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[]))
WITH CHECK (public.has_organisation_role(organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[]));

-- No browser policies exist for OAuth transactions, token records, or trader sessions.
-- Owner Deriv connections also remain service-role only because they contain encrypted tokens.

CREATE POLICY "Members view markup snapshots" ON public.markup_statistic_snapshots FOR SELECT TO authenticated
USING (public.is_organisation_member(organisation_id, auth.uid()));
CREATE POLICY "Members view audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_organisation_member(organisation_id, auth.uid()));
CREATE POLICY "Users view active notices" ON public.system_notices FOR SELECT TO authenticated
USING (active_from <= now() AND (active_until IS NULL OR active_until > now()));
CREATE POLICY "Admins manage notices" ON public.system_notices FOR ALL TO authenticated
USING (public.has_platform_permission(auth.uid(), 'notices.write'))
WITH CHECK (public.has_platform_permission(auth.uid(), 'notices.write'));
CREATE POLICY "Members view deployment logs" ON public.deployment_logs FOR SELECT TO authenticated
USING (public.is_organisation_member(organisation_id, auth.uid()));
CREATE POLICY "Members view health checks" ON public.site_health_checks FOR SELECT TO authenticated
USING (public.is_organisation_member(organisation_id, auth.uid()));

CREATE TRIGGER update_organisations_updated_at BEFORE UPDATE ON public.organisations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organisation_members_updated_at BEFORE UPDATE ON public.organisation_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_feature_definitions_updated_at BEFORE UPDATE ON public.feature_definitions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_configurations_updated_at BEFORE UPDATE ON public.site_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deriv_applications_updated_at BEFORE UPDATE ON public.deriv_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_encrypted_token_records_updated_at BEFORE UPDATE ON public.encrypted_token_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_owner_deriv_connections_updated_at BEFORE UPDATE ON public.owner_deriv_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_system_notices_updated_at BEFORE UPDATE ON public.system_notices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.templates (id, name, description, release_status, current_version)
VALUES ('deriv-bot', 'Deriv Bot', 'Production Blockly and Options trading runtime.', 'approved', '1.0.0')
ON CONFLICT (id) DO UPDATE SET current_version = EXCLUDED.current_version, release_status = EXCLUDED.release_status;

INSERT INTO public.template_versions (
  template_id, version, runtime_package, supported_trade_types, supported_pages,
  required_scopes, optional_features, compatibility, released_at
) VALUES (
  'deriv-bot', '1.0.0', 'trading-bot-template',
  '["options","bots"]'::jsonb,
  '["home","bot","charts","portfolio","profit_table","statement","support","legal"]'::jsonb,
  ARRAY['trade'],
  ARRAY['public_market_data','options_trading','portfolio','profit_table','statement','bot_page','charts'],
  '{"runtimeConfigSchema":1,"minimumNode":"20"}'::jsonb,
  now()
) ON CONFLICT (template_id, version) DO NOTHING;

INSERT INTO public.feature_definitions (key, name, description, required_scopes, required_capabilities, supported_api, release_status)
VALUES
  ('public_market_data', 'Public market data', 'Unauthenticated market symbols and prices.', '{}', ARRAY['public_websocket'], 'Options public WebSocket', 'ready'),
  ('account_list', 'Options accounts', 'Retrieve eligible demo and real Options accounts.', ARRAY['trade'], ARRAY['trader_bff'], 'GET /trading/v1/options/accounts', 'ready'),
  ('options_trading', 'Options trading', 'Authenticated proposals and purchases.', ARRAY['trade'], ARRAY['trader_bff','authenticated_websocket'], 'Options OTP WebSocket', 'ready'),
  ('account_creation', 'Account creation', 'Create an eligible Options trading account.', ARRAY['account_manage'], ARRAY['trader_bff'], 'POST /trading/v1/options/accounts', 'experimental'),
  ('wallet_balances', 'Wallet balances', 'Display wallet balances where supported.', ARRAY['payment'], ARRAY['trader_bff'], 'Wallet API', 'experimental'),
  ('wallet_transactions', 'Wallet transactions', 'Display wallet transactions where supported.', ARRAY['payment'], ARRAY['trader_bff'], 'Wallet API', 'experimental'),
  ('markup_statistics', 'Markup statistics', 'Registered-application markup reporting.', ARRAY['application_read'], ARRAY['owner_bff'], 'GET /applications/v1/markup-statistics', 'ready'),
  ('application_management', 'Application management', 'Read registered application metadata.', ARRAY['application_read'], ARRAY['owner_bff'], 'Applications API', 'experimental')
ON CONFLICT (key) DO UPDATE SET
  required_scopes = EXCLUDED.required_scopes,
  required_capabilities = EXCLUDED.required_capabilities,
  supported_api = EXCLUDED.supported_api,
  release_status = EXCLUDED.release_status;

-- Tenant-aware site access supplements existing direct-owner policies during migration.
CREATE POLICY "Organisation members view sites" ON public.sites FOR SELECT TO authenticated
USING (
  public.is_organisation_member(organisation_id, auth.uid())
  OR public.has_platform_permission(auth.uid(), 'sites.read')
);
CREATE POLICY "Organisation editors create sites" ON public.sites FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.has_organisation_role(organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])
);
CREATE POLICY "Organisation editors update sites" ON public.sites FOR UPDATE TO authenticated
USING (
  public.has_organisation_role(organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])
  OR public.has_platform_permission(auth.uid(), 'sites.write')
)
WITH CHECK (
  public.has_organisation_role(organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])
  OR public.has_platform_permission(auth.uid(), 'sites.write')
);

-- Explicit staff policies supplement legacy admin policies without escalating read-only roles.
CREATE POLICY "Platform staff view profiles" ON public.profiles FOR SELECT TO authenticated
USING (public.has_platform_permission(auth.uid(), 'sites.read'));
CREATE POLICY "Platform support views tickets" ON public.support_tickets FOR SELECT TO authenticated
USING (public.has_platform_permission(auth.uid(), 'support.read'));
CREATE POLICY "Platform support updates tickets" ON public.support_tickets FOR UPDATE TO authenticated
USING (public.has_platform_permission(auth.uid(), 'support.write'))
WITH CHECK (public.has_platform_permission(auth.uid(), 'support.write'));
CREATE POLICY "Platform support views messages" ON public.support_messages FOR SELECT TO authenticated
USING (public.has_platform_permission(auth.uid(), 'support.read'));
CREATE POLICY "Platform support sends messages" ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.has_platform_permission(auth.uid(), 'support.write'));
CREATE POLICY "Platform support deletes messages" ON public.support_messages FOR DELETE TO authenticated
USING (public.has_platform_permission(auth.uid(), 'support.write'));

CREATE POLICY "Organisation members view site domains" ON public.site_domains FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation editors manage site domains" ON public.site_domains FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])))
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])));

CREATE POLICY "Organisation members view site settings" ON public.site_settings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation editors manage site settings" ON public.site_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])))
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])));

CREATE POLICY "Organisation members view site features" ON public.site_features FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation editors manage site features" ON public.site_features FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])))
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])));

CREATE POLICY "Organisation members view site pages" ON public.site_pages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation editors manage site pages" ON public.site_pages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])))
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])));

CREATE POLICY "Organisation members view legacy Deriv metadata" ON public.site_deriv_apps FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation editors manage legacy Deriv metadata" ON public.site_deriv_apps FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])))
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])));

CREATE POLICY "Organisation members view publish versions" ON public.site_publish_versions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation members view deployments" ON public.site_deployments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation members view tools" ON public.site_tools FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation editors manage tools" ON public.site_tools FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])))
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])));
CREATE POLICY "Organisation members view integrations" ON public.site_integrations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_organisation_member(s.organisation_id, auth.uid())));
CREATE POLICY "Organisation editors manage integrations" ON public.site_integrations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])))
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.has_organisation_role(s.organisation_id, auth.uid(), ARRAY['tenant_owner','tenant_developer']::public.platform_role[])));
