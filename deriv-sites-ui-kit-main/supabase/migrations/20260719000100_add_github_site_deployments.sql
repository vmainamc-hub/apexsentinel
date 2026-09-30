CREATE TABLE public.site_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  publish_version_id UUID REFERENCES public.site_publish_versions(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'github',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'committing', 'committed', 'failed')),
  repository_owner TEXT,
  repository_name TEXT,
  repository_branch TEXT,
  repository_path TEXT,
  commit_sha TEXT,
  commit_url TEXT,
  commit_message TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_deployments_site_created
  ON public.site_deployments(site_id, created_at DESC);

CREATE UNIQUE INDEX idx_site_deployments_active_publish_version
  ON public.site_deployments(publish_version_id)
  WHERE publish_version_id IS NOT NULL AND status <> 'failed';

ALTER TABLE public.site_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners and admins can view deployments"
ON public.site_deployments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sites
    WHERE sites.id = site_deployments.site_id
      AND sites.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Inserts and updates are deliberately service-role only. Publishing is performed
-- by the authenticated publish-site-to-github Edge Function after ownership checks.

CREATE TRIGGER update_site_deployments_updated_at
BEFORE UPDATE ON public.site_deployments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

