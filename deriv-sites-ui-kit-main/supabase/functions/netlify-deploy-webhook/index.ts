import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { audit, correlationId } from "../_shared/http.ts";

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async (req) => {
  const requestId = correlationId();
  if (req.method !== "POST")
    return respond({ error: "Method not allowed" }, 405);
  const expectedSecret = Deno.env.get("NETLIFY_WEBHOOK_SECRET") || "";
  const suppliedSecret =
    new URL(req.url).searchParams.get("secret") ||
    req.headers.get("x-reef-webhook-secret") ||
    "";
  if (!expectedSecret || suppliedSecret !== expectedSecret)
    return respond({ error: "Invalid webhook secret" }, 401);

  try {
    const payload = await req.json();
    const siteId = payload.site_id || payload.site?.id;
    if (!siteId) return respond({ error: "Netlify site ID is missing" }, 400);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: integration } = await admin
      .from("site_integrations")
      .select("site_id, netlify_site_url")
      .eq("netlify_site_id", siteId)
      .maybeSingle();
    if (!integration)
      return respond({ ignored: true, reason: "Unknown Netlify site" });

    const rawState = String(
      payload.state || payload.deploy?.state || "",
    ).toLowerCase();
    const status =
      rawState === "ready"
        ? "deployed"
        : rawState === "error" || rawState === "failed"
          ? "build_failed"
          : "building";
    const commitSha =
      payload.commit_ref || payload.commit_sha || payload.deploy?.commit_ref;
    let query = admin
      .from("site_deployments")
      .select("id")
      .eq("site_id", integration.site_id);
    if (commitSha) query = query.eq("commit_sha", commitSha);
    else query = query.in("status", ["committed", "building"]);
    const { data: deployment } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!deployment)
      return respond({ ignored: true, reason: "No matching deployment" });

    const { data: site } = await admin.from("sites").select("organisation_id").eq("id", integration.site_id).maybeSingle();

    await admin
      .from("site_deployments")
      .update({
        status,
        netlify_deploy_id: payload.id || payload.deploy?.id || null,
        netlify_deploy_url:
          payload.ssl_url || payload.url || payload.deploy_ssl_url || null,
        netlify_log_url: payload.admin_url || payload.deploy?.admin_url || null,
        deploy_context: payload.context || null,
        error_message:
          status === "build_failed"
            ? payload.error_message || payload.error || "Netlify build failed"
            : null,
        completed_at:
          status === "deployed" || status === "build_failed"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", deployment.id);
    if (site) {
      await admin.from("deployment_logs").insert({ organisation_id: site.organisation_id, site_id: integration.site_id, deployment_id: deployment.id, level: status === "build_failed" ? "error" : "info", stage: "provider_webhook", message: `Netlify deployment is ${status}`, provider: "netlify", metadata: { netlifyDeployId: payload.id || payload.deploy?.id || null, commitSha: commitSha || null } });
    }
    if (status === "deployed") {
      await Promise.all([
        admin.from("site_domains").update({
          status: "active",
          is_verified: true,
          ssl_status:
            payload.ssl_url || payload.deploy_ssl_url
              ? "provisioned"
              : "pending",
        }).eq("site_id", integration.site_id).eq("is_primary", true),
        admin.from("sites").update({ status: "active" }).eq("id", integration.site_id),
      ]);

      const healthUrl = payload.ssl_url || payload.deploy_ssl_url || integration.netlify_site_url;
      if (site && healthUrl) {
        const started = Date.now();
        try {
          const check = await fetch(healthUrl, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10_000) });
          await admin.from("site_health_checks").insert({ organisation_id: site.organisation_id, site_id: integration.site_id, deployment_id: deployment.id, url: healthUrl, status: check.ok ? "healthy" : "degraded", http_status: check.status, latency_ms: Date.now() - started });
        } catch {
          await admin.from("site_health_checks").insert({ organisation_id: site.organisation_id, site_id: integration.site_id, deployment_id: deployment.id, url: healthUrl, status: "unhealthy", latency_ms: Date.now() - started, error_code: "health_request_failed" });
        }
      }
    }
    if (site) await audit({ organisationId: site.organisation_id, siteId: integration.site_id, actorType: "provider", action: `deployment.${status}`, provider: "netlify", correlationId: requestId, metadata: { deploymentId: deployment.id, commitSha: commitSha || null } });
    return respond({ ok: true, deploymentId: deployment.id, status });
  } catch (error) {
    console.error("netlify-deploy-webhook", error);
    return respond(
      { error: error instanceof Error ? error.message : "Webhook failed" },
      500,
    );
  }
});
