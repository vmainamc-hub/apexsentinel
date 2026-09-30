import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { audit, correlationId } from "../_shared/http.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const env = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Server configuration is missing ${name}`);
  return value;
};
const netlifyRequest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`https://api.netlify.com/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env("NETLIFY_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `Netlify API failed (${response.status}): ${body.message || body.error || "Unknown error"}`,
    );
  return body;
};
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 45);

serve(async (req) => {
  const requestId = correlationId();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return respond({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization)
      return respond({ error: "Authentication required" }, 401);
    const admin = createClient(
      env("SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data: auth, error: authError } = await admin.auth.getUser(
      authorization.replace(/^Bearer\s+/i, ""),
    );
    if (authError || !auth.user)
      return respond({ error: "Invalid session" }, 401);
    const { siteId } = await req.json();
    if (typeof siteId !== "string")
      return respond({ error: "siteId is required" }, 400);

    const [{ data: site }, { data: domain }, { data: existing }] = await Promise.all([
      admin.from("sites").select("*").eq("id", siteId).maybeSingle(),
      admin
        .from("site_domains")
        .select("hostname")
        .eq("site_id", siteId)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("site_integrations")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle(),
    ]);
    if (!site) return respond({ error: "Site not found" }, 404);
    const [{ data: canEditOrganisation }, { data: canOperateSites }] = await Promise.all([
      admin.rpc("has_organisation_role", { _organisation_id: site.organisation_id, _user_id: auth.user.id, _roles: ["tenant_owner", "tenant_developer"] }),
      admin.rpc("has_platform_permission", { _user_id: auth.user.id, _permission: "deployments.write" }),
    ]);
    if (site.user_id !== auth.user.id && !canEditOrganisation && !canOperateSites)
      return respond({ error: "You do not have permission to provision this site" }, 403);
    if (existing?.netlify_site_id && existing.status === "connected")
      return respond({ integration: existing });

    const owner = env("GITHUB_REPO_OWNER");
    const repository = env("GITHUB_REPO_NAME");
    const branch = Deno.env.get("GITHUB_REPO_BRANCH") || "main";
    const accountSlug = env("NETLIFY_ACCOUNT_SLUG");
    const netlifyGitHubInstallationId = Number(
      env("NETLIFY_GITHUB_INSTALLATION_ID"),
    );
    const siteName = `${slugify(domain?.hostname || site.name || "reef-site")}-${siteId.slice(0, 8)}`;

    await admin.from("site_integrations").upsert(
      {
        site_id: siteId,
        github_installation_id: Number(env("GITHUB_APP_INSTALLATION_ID")),
        github_repository_owner: owner,
        github_repository_name: repository,
        github_default_branch: branch,
        status: "provisioning",
        last_error: null,
      },
      { onConflict: "site_id" },
    );

    let netlifySite;
    try {
      netlifySite = await netlifyRequest(
        `/${encodeURIComponent(accountSlug)}/sites`,
        {
          method: "POST",
          body: JSON.stringify({
            name: siteName,
            custom_domain: domain?.hostname || undefined,
            force_ssl: true,
            repo: {
              provider: "github",
              repo: `${owner}/${repository}`,
              repo_path: `${owner}/${repository}`,
              private: true,
              branch,
              repo_branch: branch,
              installation_id: netlifyGitHubInstallationId,
              base: "new-user-interface-main",
              dir: "dist",
              cmd: "npm run build",
            },
          }),
        },
      );

      const accountId = netlifySite.account_id;
      if (accountId) {
        await netlifyRequest(
          `/accounts/${accountId}/env?site_id=${encodeURIComponent(netlifySite.id)}`,
          {
            method: "POST",
            body: JSON.stringify([
              {
                key: "REEF_SITE_ID",
                scopes: ["builds"],
                values: [{ context: "all", value: siteId }],
              },
              {
                key: "NODE_VERSION",
                scopes: ["builds"],
                values: [{ context: "all", value: "20" }],
              },
            ]),
          },
        );
      }

      const webhookSecret = env("NETLIFY_WEBHOOK_SECRET");
      const webhookUrl = `${env("SUPABASE_URL")}/functions/v1/netlify-deploy-webhook?secret=${encodeURIComponent(webhookSecret)}`;
      const hookResults = await Promise.allSettled(
        ["deploy_created", "deploy_failed", "deploy_succeeded"].map((event) =>
          netlifyRequest(
            `/hooks?site_id=${encodeURIComponent(netlifySite.id)}`,
            {
              method: "POST",
              body: JSON.stringify({
                type: "url",
                event,
                data: { url: webhookUrl },
              }),
            },
          ),
        ),
      );
      const hookFailures = hookResults.filter(
        (result) => result.status === "rejected",
      );
      if (hookFailures.length)
        console.warn(
          `Netlify created, but ${hookFailures.length} deploy notification hook(s) could not be registered`,
        );

      const { data: integration, error: integrationError } = await admin
        .from("site_integrations")
        .upsert(
          {
            site_id: siteId,
            github_installation_id: Number(env("GITHUB_APP_INSTALLATION_ID")),
            github_repository_owner: owner,
            github_repository_name: repository,
            github_default_branch: branch,
            netlify_site_id: netlifySite.id,
            netlify_site_name: netlifySite.name,
            netlify_site_url: netlifySite.ssl_url || netlifySite.url,
            netlify_admin_url: netlifySite.admin_url,
            netlify_account_id: netlifySite.account_id,
            status: "connected",
            last_error: null,
          },
          { onConflict: "site_id" },
        )
        .select()
        .single();
      if (integrationError) throw new Error(integrationError.message);
      await audit({ organisationId: site.organisation_id, siteId, actorUserId: auth.user.id, actorType: canOperateSites ? "platform_admin" : "platform_owner", action: "deployment.site_provisioned", provider: "netlify", correlationId: requestId, metadata: { netlifySiteId: netlifySite.id, repository: `${owner}/${repository}` } });
      return respond({ integration });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Provisioning failed";
      await admin
        .from("site_integrations")
        .update({ status: "failed", last_error: message })
        .eq("site_id", siteId);
      await audit({ organisationId: site.organisation_id, siteId, actorUserId: auth.user.id, actorType: canOperateSites ? "platform_admin" : "platform_owner", action: "deployment.site_provision_failed", provider: "netlify", correlationId: requestId, metadata: { errorCode: "netlify_provision_failed" } });
      throw error;
    }
  } catch (error) {
    console.error("provision-site-netlify", error);
    return respond({ error: "Provisioning failed. Contact support with the correlation ID.", code: "netlify_provision_failed", correlationId: requestId }, 500);
  }
});
