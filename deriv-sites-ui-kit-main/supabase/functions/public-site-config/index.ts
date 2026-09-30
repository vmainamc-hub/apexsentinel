import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type JsonRecord = Record<string, string>;
type RuntimeSiteConfigResponse = {
  schemaVersion: number;
  tenantId: string;
  template: { id: string; version: string };
  site: {
    id: string;
    name: string;
    hostname: string;
  };
  branding: {
    brandName: string;
    logoUrl?: string;
    faviconUrl?: string;
    theme: {
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      headerBgColor?: string;
      headerTextColor?: string;
    };
    customCssVars?: Record<string, string>;
  };
  deriv: {
    oauthClientId?: string;
    appId?: string;
    gatewayUrl: string;
    requiredScopes: string[];
    environment: "production" | "staging";
  };
  features: {
    botIdeas?: boolean;
    printPopups?: boolean;
    autoTrades?: boolean;
    manualTrading?: boolean;
    scanner?: boolean;
    chart?: boolean;
    bestBots?: boolean;
    copyTrading?: boolean;
    percentageTool?: boolean;
  };
  pages: Array<{
    key: string;
    label?: string;
    enabled: boolean;
    order: number;
  }>;
  bots: Array<{
    id?: string;
    name: string;
    filePath?: string;
    displayOrder?: number;
    isActive?: boolean;
  }>;
  navigation?: Array<{ key: string; label: string; slug: string; enabled: boolean; order: number }>;
  legal?: { privacyUrl?: string; termsUrl?: string; riskDisclaimer?: string; disclaimerText?: string };
  tools?: Array<{
    key: string;
    name: string;
    enabled: boolean;
    version: string;
    displayOrder: number;
    settings?: Record<string, unknown>;
  }>;
};

const normalizeHostname = (value: string | null): string | null => {
  if (!value) return null;

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/\.$/, "");
  } catch {
    return trimmed
      .replace(/^https?:\/\//, "")
      .replace(/[/?#].*$/, "")
      .replace(/:\d+$/, "")
      .replace(/\.$/, "");
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const tryBuildResponseFromSnapshot = (
  snapshot: unknown,
  fallbackHostname: string,
  fallbackTenantId: string,
  gatewayUrl: string,
): RuntimeSiteConfigResponse | null => {
  if (!isObject(snapshot)) return null;

  // New publisher snapshots already use the frontend-safe runtime contract.
  if (isObject(snapshot.site) && isObject(snapshot.branding) && isObject(snapshot.deriv)) {
    const direct = snapshot as unknown as RuntimeSiteConfigResponse;
    return {
      ...direct,
      schemaVersion: direct.schemaVersion || 1,
      tenantId: direct.tenantId || fallbackTenantId,
      template: direct.template || { id: "deriv-bot", version: "1.0.0" },
      site: {
        ...direct.site,
        hostname: direct.site.hostname || fallbackHostname,
      },
      features: direct.features || {},
      deriv: {
        ...direct.deriv,
        gatewayUrl,
        requiredScopes: direct.deriv.requiredScopes || ["trade"],
        environment: direct.deriv.environment || "production",
      },
      pages: Array.isArray(direct.pages) ? direct.pages : [],
      bots: Array.isArray(direct.bots) ? direct.bots : [],
      tools: Array.isArray(direct.tools) ? direct.tools : [],
    };
  }

  const site = isObject(snapshot.site) ? snapshot.site : null;
  const settings = isObject(snapshot.settings) ? snapshot.settings : null;
  const features = isObject(snapshot.features) ? snapshot.features : null;
  const derivApp = isObject(snapshot.derivApp) ? snapshot.derivApp : null;
  const pages = Array.isArray(snapshot.pages) ? snapshot.pages : [];
  const botsManifest = Array.isArray(snapshot.botsManifest) ? snapshot.botsManifest : [];
  const domain = isObject(snapshot.domain) ? snapshot.domain : null;

  if (!site) return null;

  const customCssVars =
    settings && isObject(settings.custom_css_vars_json)
      ? (settings.custom_css_vars_json as JsonRecord)
      : undefined;

  return {
    schemaVersion: 1,
    tenantId: fallbackTenantId,
    template: { id: "deriv-bot", version: "1.0.0" },
    site: {
      id: typeof site.id === "string" ? site.id : "",
      name:
        (settings && typeof settings.site_name === "string" && settings.site_name) ||
        (typeof site.name === "string" ? site.name : ""),
      hostname:
        (domain && typeof domain.hostname === "string" && domain.hostname) ||
        fallbackHostname,
    },
    branding: {
      brandName:
        (settings && typeof settings.brand_name === "string" && settings.brand_name) ||
        (settings && typeof settings.site_name === "string" && settings.site_name) ||
        (typeof site.name === "string" ? site.name : ""),
      logoUrl: settings && typeof settings.logo_url === "string" ? settings.logo_url : undefined,
      faviconUrl: settings && typeof settings.favicon_url === "string" ? settings.favicon_url : undefined,
      theme: {
        primaryColor: settings && typeof settings.primary_color === "string" ? settings.primary_color : undefined,
        secondaryColor: settings && typeof settings.secondary_color === "string" ? settings.secondary_color : undefined,
        accentColor: settings && typeof settings.accent_color === "string" ? settings.accent_color : undefined,
        headerBgColor: settings && typeof settings.header_bg_color === "string" ? settings.header_bg_color : undefined,
        headerTextColor: settings && typeof settings.header_text_color === "string" ? settings.header_text_color : undefined,
      },
      customCssVars,
    },
    deriv: {
      oauthClientId: derivApp && typeof derivApp.oauth_client_id === "string" ? derivApp.oauth_client_id : undefined,
      appId: derivApp && typeof derivApp.deriv_app_id === "string" ? derivApp.deriv_app_id : undefined,
      gatewayUrl,
      requiredScopes: ["trade"],
      environment: "production",
    },
    features: {
      botIdeas: features && typeof features.bot_ideas === "boolean" ? features.bot_ideas : undefined,
      printPopups: features && typeof features.print_popups === "boolean" ? features.print_popups : undefined,
      autoTrades: features && typeof features.auto_trades === "boolean" ? features.auto_trades : undefined,
      manualTrading: features && typeof features.manual_trading === "boolean" ? features.manual_trading : undefined,
      scanner: features && typeof features.scanner === "boolean" ? features.scanner : undefined,
      chart: features && typeof features.chart === "boolean" ? features.chart : undefined,
      bestBots: features && typeof features.best_bots === "boolean" ? features.best_bots : undefined,
      copyTrading: features && typeof features.copy_trading === "boolean" ? features.copy_trading : undefined,
      percentageTool:
        features && typeof features.percentage_tool === "boolean" ? features.percentage_tool : undefined,
    },
    pages: pages
      .filter(isObject)
      .map(page => ({
        key: typeof page.page_key === "string" ? page.page_key : "",
        label: typeof page.label === "string" ? page.label : undefined,
        enabled: typeof page.enabled === "boolean" ? page.enabled : true,
        order: typeof page.sort_order === "number" ? page.sort_order : 0,
      }))
      .filter(page => page.key),
    bots: botsManifest
      .filter(isObject)
      .map(bot => ({
        id: typeof bot.bot_id === "string" ? bot.bot_id : undefined,
        name:
          typeof bot.display_name === "string" && bot.display_name
            ? bot.display_name
            : typeof bot.file_path === "string"
              ? bot.file_path
              : "Unnamed Bot",
        filePath: typeof bot.file_path === "string" ? bot.file_path : undefined,
        displayOrder: typeof bot.display_order === "number" ? bot.display_order : undefined,
        isActive: typeof bot.is_active === "boolean" ? bot.is_active : undefined,
      })),
  };
};

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(req.url);
    const hostname = normalizeHostname(url.searchParams.get("hostname"));

    if (!hostname) {
      return json({ error: "hostname query parameter is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server configuration error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: domainRecord, error: domainError } = await supabaseAdmin
      .from("site_domains")
      .select("site_id, hostname, is_verified, status")
      .eq("hostname", hostname)
      .eq("is_verified", true)
      .in("status", ["verified", "active"])
      .maybeSingle();

    if (domainError) {
      console.error("public-site-config domain lookup error", domainError);
      return json({ error: "Failed to resolve hostname" }, 500);
    }

    if (!domainRecord) {
      return json({ error: "Site config not found for hostname" }, 404);
    }

    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id, name, status, organisation_id, active_template_version")
      .eq("id", domainRecord.site_id)
      .eq("status", "active")
      .maybeSingle();

    if (siteError) {
      console.error("public-site-config site lookup error", siteError);
      return json({ error: "Failed to resolve site" }, 500);
    }

    if (!site) {
      return json({ error: "Active site not found for hostname" }, 404);
    }

    const { data: latestPublishedSnapshot, error: snapshotError } = await supabaseAdmin
      .from("site_publish_versions")
      .select("config_snapshot_json")
      .eq("site_id", site.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      console.error("public-site-config snapshot lookup error", snapshotError);
      return json({ error: "Failed to resolve site snapshot" }, 500);
    }

    const snapshotResponse = tryBuildResponseFromSnapshot(
      latestPublishedSnapshot?.config_snapshot_json,
      domainRecord.hostname,
      site.organisation_id,
      "/api",
    );

    if (snapshotResponse) {
      return json(snapshotResponse);
    }

    const [settingsResult, featuresResult, pagesResult, derivResult, botsResult, toolsResult] = await Promise.all([
      supabaseAdmin
        .from("site_settings")
        .select("site_name, brand_name, logo_url, favicon_url, primary_color, secondary_color, accent_color, header_bg_color, header_text_color, custom_css_vars_json")
        .eq("site_id", site.id)
        .maybeSingle(),
      supabaseAdmin
        .from("site_features")
        .select("bot_ideas, print_popups, auto_trades, manual_trading, scanner, chart, best_bots, copy_trading, percentage_tool")
        .eq("site_id", site.id)
        .maybeSingle(),
      supabaseAdmin
        .from("site_pages")
        .select("page_key, label, enabled, sort_order")
        .eq("site_id", site.id)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("site_deriv_apps")
        .select("oauth_client_id, deriv_app_id, redirect_uri, use_legacy_oauth_login, include_legacy_app_id_in_oauth")
        .eq("site_id", site.id)
        .maybeSingle(),
      supabaseAdmin
        .from("site_bots_manifest")
        .select("bot_id, display_name, file_path, display_order, is_active")
        .eq("site_id", site.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabaseAdmin
        .from("site_tools")
        .select("enabled, version, display_order, settings_json, tool:tools(key, name)")
        .eq("site_id", site.id)
        .order("display_order", { ascending: true }),
    ]);

    const queryError =
      settingsResult.error ||
      featuresResult.error ||
      pagesResult.error ||
      derivResult.error ||
      botsResult.error ||
      toolsResult.error;

    if (queryError) {
      console.error("public-site-config config lookup error", queryError);
      return json({ error: "Failed to fetch site config" }, 500);
    }

    const settings = settingsResult.data;
    const features = featuresResult.data;
    const pages = pagesResult.data ?? [];
    const deriv = derivResult.data;
    const bots = botsResult.data ?? [];
    const tools = toolsResult.data ?? [];
    const customCssVars =
      settings?.custom_css_vars_json &&
      typeof settings.custom_css_vars_json === "object" &&
      !Array.isArray(settings.custom_css_vars_json)
        ? (settings.custom_css_vars_json as JsonRecord)
        : undefined;

    return json({
      schemaVersion: 1,
      tenantId: site.organisation_id,
      template: { id: "deriv-bot", version: site.active_template_version || "1.0.0" },
      site: {
        id: site.id,
        name: settings?.site_name || site.name,
        hostname: domainRecord.hostname,
      },
      branding: {
        brandName: settings?.brand_name || settings?.site_name || site.name,
        logoUrl: settings?.logo_url || undefined,
        faviconUrl: settings?.favicon_url || undefined,
        theme: {
          primaryColor: settings?.primary_color || undefined,
          secondaryColor: settings?.secondary_color || undefined,
          accentColor: settings?.accent_color || undefined,
          headerBgColor: settings?.header_bg_color || undefined,
          headerTextColor: settings?.header_text_color || undefined,
        },
        customCssVars,
      },
      deriv: {
        oauthClientId: deriv?.oauth_client_id || undefined,
        appId: deriv?.deriv_app_id || undefined,
        gatewayUrl: "/api",
        requiredScopes: ["trade"],
        environment: "production",
      },
      features: {
        botIdeas: features?.bot_ideas ?? undefined,
        printPopups: features?.print_popups ?? undefined,
        autoTrades: features?.auto_trades ?? undefined,
        manualTrading: features?.manual_trading ?? undefined,
        scanner: features?.scanner ?? undefined,
        chart: features?.chart ?? undefined,
        bestBots: features?.best_bots ?? undefined,
        copyTrading: features?.copy_trading ?? undefined,
        percentageTool: features?.percentage_tool ?? undefined,
      },
      pages: pages.map(page => ({
        key: page.page_key,
        label: page.label || undefined,
        enabled: page.enabled,
        order: page.sort_order,
      })),
      bots: bots.map(bot => ({
        id: bot.bot_id || undefined,
        name: bot.display_name,
        filePath: bot.file_path || undefined,
        displayOrder: bot.display_order ?? undefined,
        isActive: bot.is_active,
      })),
      tools: tools.map(siteTool => ({
        key: siteTool.tool.key,
        name: siteTool.tool.name,
        enabled: siteTool.enabled,
        version: siteTool.version,
        displayOrder: siteTool.display_order,
        settings: siteTool.settings_json || {},
      })),
    });
  } catch (error: unknown) {
    console.error("public-site-config unexpected error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
