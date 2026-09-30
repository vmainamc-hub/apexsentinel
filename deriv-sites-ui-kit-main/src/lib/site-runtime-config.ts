import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const DEFAULT_SITE_PAGES = [
  { page_key: "bot_ideas", label: "Bot Ideas", enabled: true, sort_order: 0 },
  { page_key: "auto_trades", label: "Auto Trades", enabled: true, sort_order: 1 },
  { page_key: "manual_trading", label: "Manual Trading", enabled: true, sort_order: 2 },
  { page_key: "scanner", label: "Scanner", enabled: true, sort_order: 3 },
  { page_key: "best_bots", label: "Best Bots", enabled: true, sort_order: 4 },
] as const;

export type SiteDomainRow = Tables<"site_domains">;
export type SiteSettingsRow = Tables<"site_settings">;
export type SiteFeaturesRow = Tables<"site_features">;
export type SitePageRow = Tables<"site_pages">;
export type SiteDerivAppRow = Tables<"site_deriv_apps">;
export type SiteBotsManifestRow = Tables<"site_bots_manifest">;
export type SitePublishVersionRow = Tables<"site_publish_versions">;
export type SiteDeploymentRow = Tables<"site_deployments">;
export type ToolRow = Tables<"tools">;
export type SiteToolRow = Tables<"site_tools">;
export type SiteIntegrationRow = Tables<"site_integrations">;
export type SiteToolWithTool = SiteToolRow & { tool: ToolRow };
export type XmlBotRow = Tables<"xml_bots">;
export type SiteRow = Tables<"sites">;

export type SiteRuntimeConfigAdmin = {
  site: SiteRow | null;
  domain: SiteDomainRow | null;
  settings: SiteSettingsRow | null;
  features: SiteFeaturesRow | null;
  pages: SitePageRow[];
  derivApp: SiteDerivAppRow | null;
  botsManifest: SiteBotsManifestRow[];
  xmlBots: XmlBotRow[];
  publishVersions: SitePublishVersionRow[];
};

export type RuntimeSiteConfigSnapshot = {
  site: SiteRow | null;
  domain: SiteDomainRow | null;
  settings: SiteSettingsRow | null;
  features: SiteFeaturesRow | null;
  pages: SitePageRow[];
  derivApp: SiteDerivAppRow | null;
  botsManifest: SiteBotsManifestRow[];
};

export type SiteSettingsInput = Pick<
  TablesInsert<"site_settings">,
  | "site_name"
  | "logo_url"
  | "favicon_url"
  | "primary_color"
  | "secondary_color"
  | "accent_color"
  | "header_bg_color"
  | "header_text_color"
  | "dark_mode_default"
  | "custom_css_vars_json"
> & {
  brand_name?: string | null;
};

export type SiteFeaturesInput = Pick<
  TablesInsert<"site_features">,
  | "bot_ideas"
  | "print_popups"
  | "auto_trades"
  | "manual_trading"
  | "scanner"
  | "chart"
  | "best_bots"
  | "copy_trading"
  | "percentage_tool"
>;

export type SitePageInput = Pick<
  TablesInsert<"site_pages">,
  "page_key" | "label" | "enabled" | "sort_order"
> & { id?: string };

export type SiteDerivAppInput = Pick<
  TablesInsert<"site_deriv_apps">,
  | "oauth_client_id"
  | "deriv_app_id"
  | "redirect_uri"
  | "use_legacy_oauth_login"
  | "include_legacy_app_id_in_oauth"
>;

export type SiteDomainInput = Pick<
  TablesInsert<"site_domains">,
  "hostname" | "is_primary" | "status"
> & {
  id?: string;
  is_verified?: boolean;
  ssl_status?: string | null;
};

export type SiteBotsManifestInput = Array<
  Pick<
    TablesInsert<"site_bots_manifest">,
    "bot_id" | "display_name" | "description" | "file_path" | "thumbnail_url" | "category" | "display_order" | "is_active"
  > & { id?: string }
>;

const buildRuntimeConfigSnapshot = (config: SiteRuntimeConfigAdmin): RuntimeSiteConfigSnapshot => ({
  site: config.site,
  domain: config.domain,
  settings: config.settings,
  features: config.features,
  pages: config.pages,
  derivApp: config.derivApp,
  botsManifest: config.botsManifest,
});

export const getDefaultSitePages = (): SitePageInput[] =>
  DEFAULT_SITE_PAGES.map(page => ({ ...page }));

export async function getSiteRuntimeConfigAdmin(siteId: string): Promise<SiteRuntimeConfigAdmin> {
  const [
    siteResult,
    domainResult,
    settingsResult,
    featuresResult,
    pagesResult,
    derivAppResult,
    botsManifestResult,
    xmlBotsResult,
    publishVersionsResult,
  ] = await Promise.all([
    supabase.from("sites").select("*").eq("id", siteId).maybeSingle(),
    supabase
      .from("site_domains")
      .select("*")
      .eq("site_id", siteId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("site_settings").select("*").eq("site_id", siteId).maybeSingle(),
    supabase.from("site_features").select("*").eq("site_id", siteId).maybeSingle(),
    supabase.from("site_pages").select("*").eq("site_id", siteId).order("sort_order", { ascending: true }),
    supabase.from("site_deriv_apps").select("*").eq("site_id", siteId).maybeSingle(),
    supabase.from("site_bots_manifest").select("*").eq("site_id", siteId).order("display_order", { ascending: true }),
    supabase.from("xml_bots").select("*").eq("site_id", siteId).order("display_order", { ascending: true }),
    supabase.from("site_publish_versions").select("*").eq("site_id", siteId).order("created_at", { ascending: false }).limit(5),
  ]);

  const errors = [
    siteResult.error,
    domainResult.error,
    settingsResult.error,
    featuresResult.error,
    pagesResult.error,
    derivAppResult.error,
    botsManifestResult.error,
    xmlBotsResult.error,
    publishVersionsResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors[0]?.message || "Failed to load site runtime config");
  }

  return {
    site: siteResult.data,
    domain: domainResult.data,
    settings: settingsResult.data,
    features: featuresResult.data,
    pages: pagesResult.data || [],
    derivApp: derivAppResult.data,
    botsManifest: botsManifestResult.data || [],
    xmlBots: xmlBotsResult.data || [],
    publishVersions: publishVersionsResult.data || [],
  };
}

export async function upsertSiteSettings(siteId: string, input: SiteSettingsInput) {
  const payload: TablesInsert<"site_settings"> = {
    site_id: siteId,
    site_name: input.site_name?.trim() || null,
    brand_name: input.brand_name?.trim() || input.site_name?.trim() || null,
    logo_url: input.logo_url?.trim() || null,
    favicon_url: input.favicon_url?.trim() || null,
    primary_color: input.primary_color?.trim() || null,
    secondary_color: input.secondary_color?.trim() || null,
    accent_color: input.accent_color?.trim() || null,
    header_bg_color: input.header_bg_color?.trim() || null,
    header_text_color: input.header_text_color?.trim() || null,
    dark_mode_default: input.dark_mode_default ?? true,
    custom_css_vars_json: input.custom_css_vars_json ?? {},
  };

  const { data, error } = await supabase
    .from("site_settings")
    .upsert(payload, { onConflict: "site_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function upsertSiteFeatures(siteId: string, input: SiteFeaturesInput) {
  const payload: TablesInsert<"site_features"> = { site_id: siteId, ...input };
  const { data, error } = await supabase
    .from("site_features")
    .upsert(payload, { onConflict: "site_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function upsertSitePages(siteId: string, pages: SitePageInput[]) {
  const payload: TablesInsert<"site_pages">[] = pages.map(page => ({
    site_id: siteId,
    page_key: page.page_key,
    label: page.label?.trim() || null,
    enabled: page.enabled,
    sort_order: Number(page.sort_order) || 0,
  }));

  const { data, error } = await supabase
    .from("site_pages")
    .upsert(payload, { onConflict: "site_id,page_key" })
    .select()
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function upsertSiteDerivApp(siteId: string, input: SiteDerivAppInput) {
  const payload: TablesInsert<"site_deriv_apps"> = {
    site_id: siteId,
    oauth_client_id: input.oauth_client_id?.trim() || null,
    deriv_app_id: input.deriv_app_id?.trim() || null,
    redirect_uri: input.redirect_uri?.trim() || null,
    use_legacy_oauth_login: input.use_legacy_oauth_login ?? false,
    include_legacy_app_id_in_oauth: input.include_legacy_app_id_in_oauth ?? false,
  };

  const { data, error } = await supabase
    .from("site_deriv_apps")
    .upsert(payload, { onConflict: "site_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function upsertSiteDomain(siteId: string, input: SiteDomainInput) {
  const payload: TablesInsert<"site_domains"> = {
    site_id: siteId,
    hostname: input.hostname.trim().toLowerCase(),
    is_primary: input.is_primary ?? true,
    status: input.status,
    is_verified: input.is_verified ?? (input.status === "verified" || input.status === "active"),
    ssl_status: input.ssl_status ?? null,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("site_domains")
      .update(payload as TablesUpdate<"site_domains">)
      .eq("id", input.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("site_domains")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function upsertSiteBotsManifest(siteId: string, input: SiteBotsManifestInput) {
  const payload: TablesInsert<"site_bots_manifest">[] = input.map(bot => ({
    site_id: siteId,
    bot_id: bot.bot_id?.trim() || null,
    display_name: bot.display_name.trim(),
    description: bot.description?.trim() || null,
    file_path: bot.file_path?.trim() || null,
    thumbnail_url: bot.thumbnail_url?.trim() || null,
    category: bot.category?.trim() || null,
    display_order: Number(bot.display_order) || 0,
    is_active: bot.is_active ?? true,
  }));

  const { data, error } = await supabase
    .from("site_bots_manifest")
    .upsert(payload, { onConflict: "id" })
    .select()
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function syncSiteBotsManifestFromXmlBots(siteId: string) {
  const { data: xmlBots, error: xmlBotsError } = await supabase
    .from("xml_bots")
    .select("*")
    .eq("site_id", siteId)
    .order("display_order", { ascending: true });

  if (xmlBotsError) throw new Error(xmlBotsError.message);

  const xmlBotRows = xmlBots || [];

  const { data: existingManifest, error: manifestError } = await supabase
    .from("site_bots_manifest")
    .select("*")
    .eq("site_id", siteId);

  if (manifestError) throw new Error(manifestError.message);

  const existingByFilePath = new Map((existingManifest || []).map(bot => [bot.file_path || "", bot]));

  const payload: TablesInsert<"site_bots_manifest">[] = xmlBotRows.map(bot => {
    const existing = existingByFilePath.get(bot.file_path);
    return {
      id: existing?.id,
      site_id: siteId,
      bot_id: existing?.bot_id || bot.id,
      display_name: existing?.display_name || bot.file_name.replace(/\.xml$/i, ""),
      description: existing?.description || null,
      file_path: bot.file_path,
      thumbnail_url: existing?.thumbnail_url || null,
      category: existing?.category || null,
      display_order: bot.display_order,
      is_active: existing?.is_active ?? true,
    };
  });

  if (payload.length === 0) {
    return existingManifest || [];
  }

  const { data, error } = await supabase
    .from("site_bots_manifest")
    .upsert(payload, { onConflict: "id" })
    .select()
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSitePublishVersions(siteId: string) {
  const { data, error } = await supabase
    .from("site_publish_versions")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getLatestPublishedSiteConfigSnapshot(siteId: string) {
  const { data, error } = await supabase
    .from("site_publish_versions")
    .select("*")
    .eq("site_id", siteId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function createSiteConfigSnapshot(siteId: string, status: "draft" | "published", publishedBy?: string | null) {
  const config = await getSiteRuntimeConfigAdmin(siteId);

  const { data: existingVersions, error: versionError } = await supabase
    .from("site_publish_versions")
    .select("version_number")
    .eq("site_id", siteId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (versionError) throw new Error(versionError.message);

  const nextVersionNumber = (existingVersions?.[0]?.version_number ?? 0) + 1;

  const snapshot: Json = buildRuntimeConfigSnapshot(config) as unknown as Json;

  const { data, error } = await supabase
    .from("site_publish_versions")
    .insert({
      site_id: siteId,
      version_number: nextVersionNumber,
      config_snapshot_json: snapshot,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      published_by: status === "published" ? publishedBy ?? null : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createDraftSiteConfigSnapshot(siteId: string) {
  return createSiteConfigSnapshot(siteId, "draft");
}

export async function publishSiteConfigSnapshot(siteId: string, snapshotId: string, publishedBy?: string | null) {
  const { data, error } = await supabase
    .from("site_publish_versions")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: publishedBy ?? null,
    })
    .eq("site_id", siteId)
    .eq("id", snapshotId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createAndPublishSiteConfigSnapshot(siteId: string, publishedBy?: string | null) {
  return createSiteConfigSnapshot(siteId, "published", publishedBy);
}

export async function createSitePublishVersion(siteId: string, publishedBy?: string | null) {
  return createAndPublishSiteConfigSnapshot(siteId, publishedBy);
}

export async function getSiteDeployments(siteId: string): Promise<SiteDeploymentRow[]> {
  const { data, error } = await supabase
    .from("site_deployments")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSiteTools(siteId: string): Promise<{ catalogue: ToolRow[]; installed: SiteToolWithTool[] }> {
  const [catalogueResult, installedResult] = await Promise.all([
    supabase.from("tools").select("*").eq("status", "active").order("category").order("name"),
    supabase.from("site_tools").select("*, tool:tools(*)").eq("site_id", siteId).order("display_order"),
  ]);
  if (catalogueResult.error) throw new Error(catalogueResult.error.message);
  if (installedResult.error) throw new Error(installedResult.error.message);
  return {
    catalogue: catalogueResult.data || [],
    installed: (installedResult.data || []) as unknown as SiteToolWithTool[],
  };
}

export async function setSiteTool(siteId: string, tool: ToolRow, enabled: boolean, displayOrder: number) {
  const { data, error } = await supabase.from("site_tools").upsert({
    site_id: siteId,
    tool_id: tool.id,
    enabled,
    version: tool.current_version,
    display_order: displayOrder,
    settings_json: tool.default_settings,
  }, { onConflict: "site_id,tool_id" }).select("*, tool:tools(*)").single();
  if (error) throw new Error(error.message);
  return data as unknown as SiteToolWithTool;
}

export async function getSiteIntegration(siteId: string): Promise<SiteIntegrationRow | null> {
  const { data, error } = await supabase.from("site_integrations").select("*").eq("site_id", siteId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function provisionSite(siteId: string): Promise<SiteIntegrationRow> {
  const { data, error } = await supabase.functions.invoke<{ integration: SiteIntegrationRow }>("provision-site-netlify", {
    body: { siteId },
  });
  if (error) throw new Error(error.message);
  if (!data?.integration) throw new Error("Provisioning returned no integration");
  return data.integration;
}

export async function retryDeployment(deploymentId: string): Promise<GitHubPublishResult> {
  const { data, error } = await supabase.functions.invoke<GitHubPublishResult>("publish-site-to-github", {
    body: { retryDeploymentId: deploymentId },
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Retry returned no result");
  return data;
}

export async function rollbackSite(siteId: string, publishVersionId: string): Promise<GitHubPublishResult> {
  const { data, error } = await supabase.functions.invoke<GitHubPublishResult>("publish-site-to-github", {
    body: { siteId, rollbackVersionId: publishVersionId },
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Rollback returned no result");
  return data;
}

export type GitHubPublishResult = {
  deploymentId: string;
  version: number;
  status: "committed";
  commitSha: string;
  commitUrl: string;
};

export async function publishSiteToGitHub(siteId: string): Promise<GitHubPublishResult> {
  const { data, error } = await supabase.functions.invoke<GitHubPublishResult>("publish-site-to-github", {
    body: { siteId },
  });

  if (error) {
    let message = error.message;
    const context = "context" in error ? error.context : null;
    if (context instanceof Response) {
      const body = await context.json().catch(() => null);
      if (body?.error) message = body.error;
    }
    throw new Error(message || "Website update failed");
  }
  if (!data) throw new Error("The publisher returned no result");
  return data;
}
