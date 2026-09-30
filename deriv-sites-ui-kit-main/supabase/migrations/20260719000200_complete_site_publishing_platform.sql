CREATE TABLE public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'trading',
  icon TEXT,
  current_version TEXT NOT NULL DEFAULT '1.0.0',
  configuration_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  minimum_plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.site_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  version TEXT NOT NULL DEFAULT '1.0.0',
  display_order INTEGER NOT NULL DEFAULT 0,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, tool_id)
);

CREATE TABLE public.site_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  github_installation_id BIGINT,
  github_repository_owner TEXT,
  github_repository_name TEXT,
  github_default_branch TEXT NOT NULL DEFAULT 'main',
  github_config_root TEXT NOT NULL DEFAULT 'sites',
  netlify_site_id TEXT UNIQUE,
  netlify_site_name TEXT,
  netlify_site_url TEXT,
  netlify_admin_url TEXT,
  netlify_account_id TEXT,
  netlify_build_hook_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'provisioning', 'connected', 'failed', 'suspended')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_deployments
  DROP CONSTRAINT IF EXISTS site_deployments_status_check;

ALTER TABLE public.site_deployments
  ADD CONSTRAINT site_deployments_status_check CHECK (
    status IN (
      'draft', 'queued', 'generating', 'committing', 'committed', 'building', 'deployed',
      'generating_failed', 'commit_failed', 'build_failed', 'domain_failed', 'failed', 'cancelled'
    )
  );

ALTER TABLE public.site_deployments
  ADD COLUMN IF NOT EXISTS netlify_deploy_id TEXT,
  ADD COLUMN IF NOT EXISTS netlify_deploy_url TEXT,
  ADD COLUMN IF NOT EXISTS netlify_log_url TEXT,
  ADD COLUMN IF NOT EXISTS deploy_context TEXT,
  ADD COLUMN IF NOT EXISTS retry_of UUID REFERENCES public.site_deployments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rollback_of UUID REFERENCES public.site_publish_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_site_tools_site_order ON public.site_tools(site_id, display_order);
CREATE INDEX idx_site_integrations_netlify_site ON public.site_integrations(netlify_site_id);
CREATE INDEX idx_site_deployments_commit_sha ON public.site_deployments(commit_sha);
CREATE INDEX idx_site_deployments_netlify_deploy ON public.site_deployments(netlify_deploy_id);

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active tools"
ON public.tools FOR SELECT TO authenticated
USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage tools"
ON public.tools FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners and admins view site tools"
ON public.site_tools FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = site_tools.site_id AND sites.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Owners and admins insert site tools"
ON public.site_tools FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = site_tools.site_id AND sites.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Owners and admins update site tools"
ON public.site_tools FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = site_tools.site_id AND sites.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = site_tools.site_id AND sites.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Owners and admins delete site tools"
ON public.site_tools FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = site_tools.site_id AND sites.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Owners and admins view site integrations"
ON public.site_integrations FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = site_integrations.site_id AND sites.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Integration credentials and provider IDs are mutated by service-role Edge Functions only.

CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON public.tools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_tools_updated_at BEFORE UPDATE ON public.site_tools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_integrations_updated_at BEFORE UPDATE ON public.site_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tools (key, name, description, category, icon, minimum_plan)
VALUES
  ('bot_ideas', 'Bot Ideas', 'Community trading ideas and bot submissions.', 'bots', 'Lightbulb', 'free'),
  ('auto_trades', 'Auto Trades', 'Automated multi-market trading interface.', 'trading', 'Zap', 'free'),
  ('manual_trading', 'Manual Trading', 'Manual contracts and execution controls.', 'trading', 'MousePointer', 'free'),
  ('scanner', 'Market Scanner', 'Real-time statistical market signal scanner.', 'analysis', 'ScanSearch', 'free'),
  ('chart', 'Charts', 'Advanced live market charts and indicators.', 'analysis', 'ChartCandlestick', 'free'),
  ('best_bots', 'Best Bots', 'Curated XML bot catalogue.', 'bots', 'Bot', 'free'),
  ('copy_trading', 'Copy Trading', 'Copy selected trading strategies.', 'trading', 'Copy', 'professional'),
  ('percentage_tool', 'Percentage Tool', 'Percentage strategy and risk utilities.', 'risk', 'Percent', 'professional'),
  ('print_popups', 'Print Popups', 'Print and popup workflow utilities.', 'utility', 'Printer', 'free')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  minimum_plan = EXCLUDED.minimum_plan;

