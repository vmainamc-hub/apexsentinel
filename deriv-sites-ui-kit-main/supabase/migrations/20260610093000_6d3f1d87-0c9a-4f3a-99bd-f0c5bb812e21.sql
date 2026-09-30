-- Runtime public site config foundation
-- This migration creates normalized, frontend-safe config tables for Reef Sites.
-- Private trading/auth tokens remain in existing private tables and are not exposed here.

CREATE TABLE public.site_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'active', 'disabled')),
  ssl_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT site_domains_hostname_unique UNIQUE (hostname)
);

CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  site_name TEXT,
  brand_name TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  header_bg_color TEXT,
  header_text_color TEXT,
  custom_css_vars_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_site_id_unique UNIQUE (site_id)
);

CREATE TABLE public.site_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  bot_ideas BOOLEAN NOT NULL DEFAULT false,
  print_popups BOOLEAN NOT NULL DEFAULT false,
  auto_trades BOOLEAN NOT NULL DEFAULT false,
  manual_trading BOOLEAN NOT NULL DEFAULT false,
  scanner BOOLEAN NOT NULL DEFAULT false,
  chart BOOLEAN NOT NULL DEFAULT false,
  best_bots BOOLEAN NOT NULL DEFAULT false,
  copy_trading BOOLEAN NOT NULL DEFAULT false,
  percentage_tool BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT site_features_site_id_unique UNIQUE (site_id)
);

CREATE TABLE public.site_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT site_pages_site_id_page_key_unique UNIQUE (site_id, page_key)
);

CREATE TABLE public.site_deriv_apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  oauth_client_id TEXT,
  deriv_app_id TEXT,
  redirect_uri TEXT,
  use_legacy_oauth_login BOOLEAN NOT NULL DEFAULT false,
  include_legacy_app_id_in_oauth BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT site_deriv_apps_site_id_unique UNIQUE (site_id)
);

CREATE TABLE public.site_bots_manifest (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  bot_id TEXT,
  display_name TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  thumbnail_url TEXT,
  category TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.site_publish_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  config_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT site_publish_versions_site_id_version_number_unique UNIQUE (site_id, version_number)
);

CREATE INDEX idx_site_domains_hostname ON public.site_domains(hostname);
CREATE INDEX idx_site_domains_site_id ON public.site_domains(site_id);
CREATE INDEX idx_site_settings_site_id ON public.site_settings(site_id);
CREATE INDEX idx_site_features_site_id ON public.site_features(site_id);
CREATE INDEX idx_site_pages_site_id_page_key ON public.site_pages(site_id, page_key);
CREATE INDEX idx_site_deriv_apps_site_id ON public.site_deriv_apps(site_id);
CREATE INDEX idx_site_bots_manifest_site_id ON public.site_bots_manifest(site_id);
CREATE INDEX idx_site_publish_versions_site_id_status ON public.site_publish_versions(site_id, status);

ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_deriv_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_bots_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_publish_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own site domains"
ON public.site_domains
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_domains.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own site domains"
ON public.site_domains
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_domains.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update their own site domains"
ON public.site_domains
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_domains.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_domains.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can delete their own site domains"
ON public.site_domains
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_domains.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view their own site settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_settings.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own site settings"
ON public.site_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_settings.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update their own site settings"
ON public.site_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_settings.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_settings.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can delete their own site settings"
ON public.site_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_settings.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view their own site features"
ON public.site_features
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_features.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own site features"
ON public.site_features
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_features.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update their own site features"
ON public.site_features
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_features.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_features.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can delete their own site features"
ON public.site_features
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_features.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view their own site pages"
ON public.site_pages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_pages.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own site pages"
ON public.site_pages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_pages.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update their own site pages"
ON public.site_pages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_pages.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_pages.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can delete their own site pages"
ON public.site_pages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_pages.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view their own site deriv apps"
ON public.site_deriv_apps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_deriv_apps.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own site deriv apps"
ON public.site_deriv_apps
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_deriv_apps.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update their own site deriv apps"
ON public.site_deriv_apps
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_deriv_apps.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_deriv_apps.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can delete their own site deriv apps"
ON public.site_deriv_apps
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_deriv_apps.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view their own site bots manifest"
ON public.site_bots_manifest
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_bots_manifest.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own site bots manifest"
ON public.site_bots_manifest
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_bots_manifest.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update their own site bots manifest"
ON public.site_bots_manifest
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_bots_manifest.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_bots_manifest.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can delete their own site bots manifest"
ON public.site_bots_manifest
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_bots_manifest.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view their own site publish versions"
ON public.site_publish_versions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_publish_versions.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own site publish versions"
ON public.site_publish_versions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_publish_versions.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update their own site publish versions"
ON public.site_publish_versions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_publish_versions.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_publish_versions.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can delete their own site publish versions"
ON public.site_publish_versions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_publish_versions.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER update_site_domains_updated_at
BEFORE UPDATE ON public.site_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_domain_purchases_updated_at();

CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_domain_purchases_updated_at();

CREATE TRIGGER update_site_features_updated_at
BEFORE UPDATE ON public.site_features
FOR EACH ROW
EXECUTE FUNCTION public.update_domain_purchases_updated_at();

CREATE TRIGGER update_site_pages_updated_at
BEFORE UPDATE ON public.site_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_domain_purchases_updated_at();

CREATE TRIGGER update_site_deriv_apps_updated_at
BEFORE UPDATE ON public.site_deriv_apps
FOR EACH ROW
EXECUTE FUNCTION public.update_domain_purchases_updated_at();

CREATE TRIGGER update_site_bots_manifest_updated_at
BEFORE UPDATE ON public.site_bots_manifest
FOR EACH ROW
EXECUTE FUNCTION public.update_domain_purchases_updated_at();
