import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { audit, correlationId } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const githubHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "reef-sites-publisher",
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Server configuration is missing ${name}`);
  return value;
};

const encodeBase64Url = (value: Uint8Array | string) => {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const derLength = (length: number) => {
  if (length < 128) return new Uint8Array([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>= 8) bytes.unshift(value & 0xff);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
};

const derSequence = (...parts: Uint8Array[]) => {
  const bodyLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(1 + derLength(bodyLength).length + bodyLength);
  output[0] = 0x30;
  const lengthBytes = derLength(bodyLength);
  output.set(lengthBytes, 1);
  let offset = 1 + lengthBytes.length;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

// GitHub App downloads are commonly PKCS#1. WebCrypto imports PKCS#8, so wrap
// PKCS#1 keys in the standard rsaEncryption PrivateKeyInfo envelope.
const pkcs1ToPkcs8 = (pkcs1: Uint8Array) => {
  const algorithm = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const octetLength = derLength(pkcs1.length);
  const privateKey = new Uint8Array(1 + octetLength.length + pkcs1.length);
  privateKey[0] = 0x04;
  privateKey.set(octetLength, 1);
  privateKey.set(pkcs1, 1 + octetLength.length);
  return derSequence(version, algorithm, privateKey);
};

const createAppJwt = async (appId: string, privateKeyPem: string) => {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }),
  );
  const signingInput = `${header}.${payload}`;
  const normalizedPem = privateKeyPem.replace(/\\n/g, "\n");
  let keyData: Uint8Array;
  if (normalizedPem.includes("BEGIN RSA PRIVATE KEY")) {
    keyData = Uint8Array.from(
      atob(
        normalizedPem.replace(
          /-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----|\s/g,
          "",
        ),
      ),
      (char) => char.charCodeAt(0),
    );
    keyData = pkcs1ToPkcs8(keyData);
  } else {
    keyData = Uint8Array.from(
      atob(
        normalizedPem.replace(
          /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
          "",
        ),
      ),
      (char) => char.charCodeAt(0),
    );
  }
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
};

const githubError = async (response: Response, action: string) => {
  const body = await response.json().catch(() => ({}));
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  const suffix =
    remaining === "0" && reset
      ? ` GitHub rate limit resets at ${new Date(Number(reset) * 1000).toISOString()}.`
      : "";
  return new Error(
    `${action} failed (${response.status}): ${body.message || "GitHub API error"}.${suffix}`,
  );
};

const getInstallationToken = async () => {
  const jwt = await createAppJwt(
    requiredEnv("GITHUB_APP_ID"),
    requiredEnv("GITHUB_APP_PRIVATE_KEY"),
  );
  const installationId = requiredEnv("GITHUB_APP_INSTALLATION_ID");
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: githubHeaders(jwt),
    },
  );
  if (!response.ok)
    throw await githubError(response, "Creating GitHub installation token");
  const data = await response.json();
  return data.token as string;
};

const toBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const commitFiles = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: Array<{ path: string; content: string }>,
) => {
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const refResponse = await fetch(
      `${api}/git/ref/heads/${encodeURIComponent(branch)}`,
      { headers: githubHeaders(token) },
    );
    if (!refResponse.ok)
      throw await githubError(refResponse, "Reading repository branch");
    const headSha = (await refResponse.json()).object.sha as string;

    const commitResponse = await fetch(`${api}/git/commits/${headSha}`, {
      headers: githubHeaders(token),
    });
    if (!commitResponse.ok)
      throw await githubError(commitResponse, "Reading repository commit");
    const baseTree = (await commitResponse.json()).tree.sha as string;

    const blobs = await Promise.all(
      files.map(async (file) => {
        const response = await fetch(`${api}/git/blobs`, {
          method: "POST",
          headers: {
            ...githubHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: toBase64(file.content),
            encoding: "base64",
          }),
        });
        if (!response.ok)
          throw await githubError(response, `Generating ${file.path}`);
        return {
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: (await response.json()).sha,
        };
      }),
    );

    const treeResponse = await fetch(`${api}/git/trees`, {
      method: "POST",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseTree, tree: blobs }),
    });
    if (!treeResponse.ok)
      throw await githubError(treeResponse, "Generating site files tree");
    const treeSha = (await treeResponse.json()).sha;

    const newCommitResponse = await fetch(`${api}/git/commits`, {
      method: "POST",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, tree: treeSha, parents: [headSha] }),
    });
    if (!newCommitResponse.ok)
      throw await githubError(newCommitResponse, "Creating site commit");
    const commit = await newCommitResponse.json();

    const updateRefResponse = await fetch(
      `${api}/git/refs/heads/${encodeURIComponent(branch)}`,
      {
        method: "PATCH",
        headers: {
          ...githubHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sha: commit.sha, force: false }),
      },
    );
    if (updateRefResponse.ok) {
      return {
        sha: commit.sha as string,
        htmlUrl: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
      };
    }
    if (updateRefResponse.status !== 409 || attempt === 3) {
      throw await githubError(updateRefResponse, "Updating repository branch");
    }
  }
  throw new Error(
    "Repository changed repeatedly while publishing; please retry",
  );
};

serve(async (req) => {
  const requestId = correlationId();
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return jsonResponse({ error: "Authentication required" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const userToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } =
    await admin.auth.getUser(userToken);
  if (authError || !authData.user)
    return jsonResponse({ error: "Invalid session" }, 401);

  let deploymentId: string | null = null;
  let publishVersionId: string | null = null;
  let auditOrganisationId: string | null = null;
  let auditSiteId: string | null = null;
  let auditActorType: "platform_owner" | "platform_admin" = "platform_owner";

  try {
    const input = await req.json();
    let siteId = typeof input.siteId === "string" ? input.siteId : "";
    let retryOf: string | null = null;
    let rollbackVersionId =
      typeof input.rollbackVersionId === "string"
        ? input.rollbackVersionId
        : null;
    if (typeof input.retryDeploymentId === "string") {
      const { data: retryDeployment, error: retryError } = await admin
        .from("site_deployments")
        .select("id, site_id, publish_version_id")
        .eq("id", input.retryDeploymentId)
        .maybeSingle();
      if (retryError) throw new Error(retryError.message);
      if (!retryDeployment)
        return jsonResponse(
          { error: "Deployment to retry was not found" },
          404,
        );
      siteId = retryDeployment.site_id;
      retryOf = retryDeployment.id;
      rollbackVersionId = retryDeployment.publish_version_id;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(siteId)) {
      return jsonResponse({ error: "A valid siteId is required" }, 400);
    }

    const { data: site, error: siteError } = await admin.from("sites").select("*").eq("id", siteId).maybeSingle();
    if (siteError) throw new Error(siteError.message);
    if (!site) return jsonResponse({ error: "Site not found" }, 404);
    auditOrganisationId = site.organisation_id;
    auditSiteId = site.id;
    const [{ data: canEditOrganisation }, { data: canOperateSites }] = await Promise.all([
      admin.rpc("has_organisation_role", { _organisation_id: site.organisation_id, _user_id: authData.user.id, _roles: ["tenant_owner", "tenant_developer"] }),
      admin.rpc("has_platform_permission", { _user_id: authData.user.id, _permission: "sites.write" }),
    ]);
    if (site.user_id !== authData.user.id && !canEditOrganisation && !canOperateSites)
      return jsonResponse({ error: "You do not have permission to publish this site" }, 403);
    auditActorType = canOperateSites ? "platform_admin" : "platform_owner";

    const [
      domain,
      settings,
      features,
      pages,
      derivApp,
      bots,
      tools,
      integration,
      latestVersion,
      configuration,
      modernDerivApp,
    ] = await Promise.all([
      admin
        .from("site_domains")
        .select("*")
        .eq("site_id", siteId)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("site_settings")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle(),
      admin
        .from("site_features")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle(),
      admin
        .from("site_pages")
        .select("*")
        .eq("site_id", siteId)
        .order("sort_order"),
      admin
        .from("site_deriv_apps")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle(),
      admin
        .from("site_bots_manifest")
        .select("*")
        .eq("site_id", siteId)
        .order("display_order"),
      admin
        .from("site_tools")
        .select("*, tool:tools(*)")
        .eq("site_id", siteId)
        .order("display_order"),
      admin
        .from("site_integrations")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle(),
      admin
        .from("site_publish_versions")
        .select("version_number")
        .eq("site_id", siteId)
        .order("version_number", { ascending: false })
        .limit(1),
      admin
        .from("site_configurations")
        .select("*")
        .eq("site_id", siteId)
        .in("status", ["draft", "valid", "invalid"])
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from("deriv_applications").select("*").eq("site_id", siteId).maybeSingle(),
    ]);
    const queryError = [
      domain.error,
      settings.error,
      features.error,
      pages.error,
      derivApp.error,
      bots.error,
      tools.error,
      integration.error,
      latestVersion.error,
      configuration.error,
      modernDerivApp.error,
    ].find(Boolean);
    if (queryError) throw new Error(queryError.message);
    if (configuration.data?.status === "invalid") {
      return jsonResponse({ error: "The current site configuration has blocking validation errors" }, 409);
    }
    if (configuration.data && (!modernDerivApp.data || !domain.data?.hostname)) {
      return jsonResponse({ error: "A domain and complete Deriv application are required before publishing" }, 409);
    }

    const version = (latestVersion.data?.[0]?.version_number ?? 0) + 1;
    const generatedAt = new Date().toISOString();
    // Deployed sites reverse-proxy /api to the central Edge Functions. Keeping
    // the BFF same-origin makes its HttpOnly cookie first-party on every site.
    const gatewayUrl = "/api";
    // The validated JSON snapshot supports registry-defined keys beyond this
    // function's static fields.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draft = configuration.data?.configuration as Record<string, any> | undefined;
    const traderScopes = (modernDerivApp.data?.configured_scopes || ["trade"]).filter((scope: string) => scope !== "application_read");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let publicConfig: Record<string, any> = {
      schemaVersion: 1,
      version,
      generatedAt,
      tenantId: site.organisation_id,
      template: {
        id: draft?.template?.id || "deriv-bot",
        version: draft?.template?.version || site.active_template_version || "1.0.0",
      },
      site: {
        id: site.id,
        name: draft?.project?.siteName || settings.data?.site_name || site.name,
        hostname: draft?.deployment?.customDomain || domain.data?.hostname || "",
      },
      branding: {
        brandName: draft?.project?.siteName || settings.data?.brand_name || settings.data?.site_name || site.name,
        logoUrl: draft?.branding?.logoUrl || settings.data?.logo_url || undefined,
        faviconUrl: draft?.branding?.faviconUrl || settings.data?.favicon_url || undefined,
        darkModeDefault: settings.data?.dark_mode_default ?? true,
        theme: {
          primaryColor: draft?.branding?.primaryColor || settings.data?.primary_color || undefined,
          secondaryColor: draft?.branding?.secondaryColor || settings.data?.secondary_color || undefined,
          accentColor: draft?.branding?.accentColor || settings.data?.accent_color || undefined,
          headerBgColor: settings.data?.header_bg_color || undefined,
          headerTextColor: settings.data?.header_text_color || undefined,
        },
        customCssVars: settings.data?.custom_css_vars_json || {},
      },
      deriv: {
        oauthClientId: modernDerivApp.data?.oauth_client_id || derivApp.data?.oauth_client_id || undefined,
        appId: modernDerivApp.data?.app_id || derivApp.data?.deriv_app_id || undefined,
        gatewayUrl,
        requiredScopes: traderScopes,
        environment: modernDerivApp.data?.environment || "production",
      },
      features: draft?.features || (features.data
        ? {
            botIdeas: features.data.bot_ideas,
            printPopups: features.data.print_popups,
            autoTrades: features.data.auto_trades,
            manualTrading: features.data.manual_trading,
            scanner: features.data.scanner,
            chart: features.data.chart,
            bestBots: features.data.best_bots,
            copyTrading: features.data.copy_trading,
            percentageTool: features.data.percentage_tool,
          }
        : {}),
      pages: draft?.navigation || (pages.data || []).map((page) => ({
        key: page.page_key,
        label: page.label || undefined,
        enabled: page.enabled,
        order: page.sort_order,
      })),
      navigation: draft?.navigation || undefined,
      legal: draft?.legal || undefined,
      bots: (bots.data || []).map((bot) => ({
        id: bot.bot_id || bot.id,
        name: bot.display_name,
        filePath: bot.file_path || undefined,
        displayOrder: bot.display_order,
        isActive: bot.is_active,
      })),
      tools: (tools.data || []).map((siteTool) => ({
        key: siteTool.tool.key,
        name: siteTool.tool.name,
        enabled: siteTool.enabled,
        version: siteTool.version,
        displayOrder: siteTool.display_order,
        settings: siteTool.settings_json || {},
      })),
    };

    if (rollbackVersionId) {
      const { data: rollbackVersion, error: rollbackError } = await admin
        .from("site_publish_versions")
        .select("id, site_id, config_snapshot_json")
        .eq("id", rollbackVersionId)
        .eq("site_id", siteId)
        .maybeSingle();
      if (rollbackError) throw new Error(rollbackError.message);
      if (!rollbackVersion)
        return jsonResponse(
          { error: "Rollback version was not found for this site" },
          404,
        );
      publicConfig = {
        ...(rollbackVersion.config_snapshot_json as Record<string, unknown>),
        schemaVersion: 1,
        version,
        generatedAt,
        tenantId: site.organisation_id,
      };
    }

    const { data: publishVersion, error: publishError } = await admin
      .from("site_publish_versions")
      .insert({
        site_id: siteId,
        version_number: version,
        config_snapshot_json: publicConfig,
        status: "publishing",
        published_by: authData.user.id,
      })
      .select()
      .single();
    if (publishError)
      throw new Error(
        `Could not reserve publish version: ${publishError.message}`,
      );
    publishVersionId = publishVersion.id;

    const owner =
      integration.data?.github_repository_owner ||
      requiredEnv("GITHUB_REPO_OWNER");
    const repo =
      integration.data?.github_repository_name ||
      requiredEnv("GITHUB_REPO_NAME");
    const root = (
      integration.data?.github_config_root ||
      Deno.env.get("GITHUB_SITES_CONFIG_ROOT") ||
      "sites"
    ).replace(/^\/+|\/+$/g, "");
    const path = `${root}/${siteId}/site.config.json`;
    const commitMessage = rollbackVersionId
      ? `revert(sites): restore ${domain.data?.hostname || siteId} as v${version}`
      : `chore(sites): publish ${domain.data?.hostname || siteId} v${version}`;

    const { data: deployment, error: deploymentError } = await admin
      .from("site_deployments")
      .insert({
        site_id: siteId,
        publish_version_id: publishVersion.id,
        requested_by: authData.user.id,
        status: "committing",
        repository_owner: owner,
        repository_name: repo,
        repository_path: path,
        commit_message: commitMessage,
        retry_of: retryOf,
        rollback_of: rollbackVersionId,
      })
      .select()
      .single();
    if (deploymentError) throw new Error(deploymentError.message);
    deploymentId = deployment.id;
    await admin.from("deployment_logs").insert({ organisation_id: site.organisation_id, site_id: siteId, deployment_id: deployment.id, level: "info", stage: "github_commit", message: "Publishing configuration to GitHub", provider: "github", metadata: { version, repository: `${owner}/${repo}`, path } });

    const token = await getInstallationToken();
    let branch =
      integration.data?.github_default_branch ||
      Deno.env.get("GITHUB_REPO_BRANCH")?.trim();
    if (!branch) {
      const repoResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers: githubHeaders(token) },
      );
      if (!repoResponse.ok)
        throw await githubError(repoResponse, "Reading repository");
      branch = (await repoResponse.json()).default_branch;
    }

    const cssVariables = {
      "--domain-primary": publicConfig.branding.theme.primaryColor,
      "--domain-secondary": publicConfig.branding.theme.secondaryColor,
      "--domain-accent": publicConfig.branding.theme.accentColor,
      "--domain-header-bg": publicConfig.branding.theme.headerBgColor,
      "--domain-header-text": publicConfig.branding.theme.headerTextColor,
      ...publicConfig.branding.customCssVars,
    };
    const brandingCss = `:root {\n${Object.entries(cssVariables)
      .filter(([, value]) => typeof value === "string" && value)
      .map(([key, value]) => `  ${key}: ${String(value)};`)
      .join("\n")}\n}\n`;
    const importedBotFiles = Array.isArray(draft?.bots)
      ? draft.bots
        .filter((bot: Record<string, unknown>) =>
          typeof bot.xmlContent === "string" &&
          bot.xmlContent.trim() &&
          (bot.isActive ?? true)
        )
        .map((bot: Record<string, unknown>, index: number) => {
          const fallbackName = `bot-${index + 1}.xml`;
          const rawName = typeof bot.fileName === "string" && bot.fileName.trim()
            ? bot.fileName
            : fallbackName;
          const safeName = rawName
            .replace(/[/\\]/g, "-")
            .replace(/[^a-zA-Z0-9._-]/g, "-")
            .replace(/-+/g, "-") || fallbackName;
          return {
            path: `${root}/${siteId}/free-bots/${safeName.endsWith(".xml") ? safeName : `${safeName}.xml`}`,
            content: `${String(bot.xmlContent).trim()}\n`,
          };
        })
      : [];
    const commit = await commitFiles(
      token,
      owner,
      repo,
      branch,
      commitMessage,
      [
        { path, content: `${JSON.stringify(publicConfig, null, 2)}\n` },
        {
          path: `${root}/${siteId}/bots-manifest.json`,
          content: `${JSON.stringify(publicConfig.bots, null, 2)}\n`,
        },
        { path: `${root}/${siteId}/branding.css`, content: brandingCss },
        ...importedBotFiles,
      ],
    );

    await Promise.all([
      admin
        .from("site_publish_versions")
        .update({ status: "published", published_at: generatedAt })
        .eq("id", publishVersion.id),
      admin
        .from("site_deployments")
        .update({
          status: "committed",
          repository_branch: branch,
          commit_sha: commit.sha,
          commit_url: commit.htmlUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", deployment.id),
      ...(configuration.data ? [
        admin.from("site_configurations").update({ status: "published", published_by: authData.user.id, published_at: generatedAt }).eq("id", configuration.data.id),
        admin.from("sites").update({ configuration_status: "published", active_configuration_version: configuration.data.version, active_template_version: configuration.data.template_version }).eq("id", siteId),
      ] : []),
      admin.from("deployment_logs").insert({ organisation_id: site.organisation_id, site_id: siteId, deployment_id: deployment.id, level: "info", stage: "github_committed", message: "Configuration committed; waiting for Netlify", provider: "github", metadata: { commitSha: commit.sha, branch } }),
    ]);

    await audit({ organisationId: site.organisation_id, siteId, actorUserId: authData.user.id, actorType: auditActorType, action: "configuration.published", provider: "github", correlationId: requestId, metadata: { deploymentId: deployment.id, version, commitSha: commit.sha } });

    return jsonResponse({
      deploymentId: deployment.id,
      version,
      status: "committed",
      commitSha: commit.sha,
      commitUrl: commit.htmlUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Publishing failed";
    console.error("publish-site-to-github", message);
    if (publishVersionId)
      await admin
        .from("site_publish_versions")
        .update({ status: "failed" })
        .eq("id", publishVersionId);
    if (deploymentId)
      await Promise.all([
        admin.from("site_deployments").update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        }).eq("id", deploymentId),
        ...(auditOrganisationId && auditSiteId ? [admin.from("deployment_logs").insert({ organisation_id: auditOrganisationId, site_id: auditSiteId, deployment_id: deploymentId, level: "error", stage: "publish_failed", message: "Site publishing failed", provider: "github", metadata: { errorCode: "publish_failed" } })] : []),
      ]);
    if (auditOrganisationId && auditSiteId) await audit({ organisationId: auditOrganisationId, siteId: auditSiteId, actorUserId: authData.user.id, actorType: auditActorType, action: "configuration.publish_failed", provider: "github", correlationId: requestId, metadata: { deploymentId, errorCode: "publish_failed" } });
    return jsonResponse({ error: "Publishing failed. Retry from deployment history or contact support with the correlation ID.", code: "publish_failed", correlationId: requestId, deploymentId }, 500);
  }
});
