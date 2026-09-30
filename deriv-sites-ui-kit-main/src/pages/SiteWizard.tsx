import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  Globe,
  Loader2,
  Palette,
  Save,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { requiredScopesForFeatures, SCOPE_REGISTRY } from "@reef-sites/deriv-auth";
import { TEMPLATE_REGISTRY } from "@reef-sites/template-registry";
import type { DerivFeature, ValidationIssue } from "@reef-sites/shared-types";
import { toast } from "sonner";
import AdminMarkupStats from "@/components/AdminMarkupStats";

type CommercialPlan = "partnership_monthly" | "one_time";

type ImportedBot = {
  id: string;
  name: string;
  description: string;
  fileName: string;
  filePath: string;
  xmlContent?: string;
  category: "free";
  displayOrder: number;
  isActive: boolean;
};

type WizardDraft = {
  commercial: {
    plan: CommercialPlan;
    paymentPhone: string;
    paymentEmail: string;
    acceptedTerms: boolean;
  };
  project: {
    siteName: string;
    internalName: string;
    description: string;
    organisationName: string;
    supportEmail: string;
    supportContact: string;
    language: string;
    region: string;
  };
  deployment: {
    subdomain: string;
    customDomain: string;
    provider: "netlify";
    branch: string;
    buildCommand: string;
    outputDirectory: string;
  };
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    logoUrl: string;
    faviconUrl: string;
    siteTitle: string;
    typography: string;
    borderRadius: string;
    poweredByDeriv: boolean;
  };
  template: { id: string; version: string };
  deriv: { appId: string; oauthClientId: string; callbackUri: string; environment: "staging" | "production"; markupRate: string };
  features: Record<DerivFeature, boolean>;
  bots: ImportedBot[];
  navigation: Array<{ key: string; label: string; slug: string; enabled: boolean; order: number }>;
  legal: { privacyUrl: string; termsUrl: string; riskDisclaimer: string; disclaimerText: string };
};

const featureChoices: Array<{ key: DerivFeature; label: string; status: "ready" | "experimental" }> = [
  { key: "public_market_data", label: "Public market data", status: "ready" },
  { key: "account_list", label: "Options account selection", status: "ready" },
  { key: "options_trading", label: "Options trading", status: "ready" },
  { key: "markup_statistics", label: "Markup statistics", status: "ready" },
  { key: "account_creation", label: "Options account creation", status: "experimental" },
  { key: "wallet_balances", label: "Wallet balances", status: "experimental" },
  { key: "wallet_transactions", label: "Wallet transactions", status: "experimental" },
  { key: "application_management", label: "Application management", status: "experimental" },
];

const steps = [
  { label: "Plan", icon: CreditCard },
  { label: "Identity", icon: Wand2 },
  { label: "Colors", icon: Palette },
  { label: "Template", icon: Eye },
  { label: "Free bots", icon: Bot },
  { label: "Deriv tools", icon: CheckCircle2 },
  { label: "Domain", icon: Globe },
  { label: "Legal", icon: AlertCircle },
  { label: "Review", icon: Check },
  { label: "Payment", icon: CreditCard },
];

const initialDraft = (): WizardDraft => ({
  commercial: { plan: "partnership_monthly", paymentPhone: "", paymentEmail: "", acceptedTerms: false },
  project: { siteName: "", internalName: "", description: "", organisationName: "", supportEmail: "", supportContact: "", language: "en", region: "" },
  deployment: { subdomain: "", customDomain: "", provider: "netlify", branch: "main", buildCommand: "npm run build", outputDirectory: "dist" },
  branding: {
    primaryColor: "#0ea5e9",
    secondaryColor: "#111827",
    accentColor: "#22c55e",
    backgroundColor: "#f8fafc",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
    logoUrl: "",
    faviconUrl: "",
    siteTitle: "",
    typography: "Inter",
    borderRadius: "8px",
    poweredByDeriv: true,
  },
  template: { id: "deriv-bot", version: "1.0.0" },
  deriv: { appId: "", oauthClientId: "", callbackUri: "", environment: "production", markupRate: "" },
  features: { public_market_data: true, account_list: true, options_trading: true, account_creation: false, wallet_balances: false, wallet_transactions: false, markup_statistics: false, application_management: false },
  bots: [],
  navigation: [
    { key: "home", label: "Home", slug: "/", enabled: true, order: 0 },
    { key: "free_bots", label: "Free Bots", slug: "/free-bots", enabled: true, order: 1 },
    { key: "bot", label: "Bot Builder", slug: "/bot", enabled: true, order: 2 },
    { key: "charts", label: "Charts", slug: "/charts", enabled: true, order: 3 },
    { key: "support", label: "Support", slug: "/support", enabled: true, order: 4 },
    { key: "privacy", label: "Privacy", slug: "/privacy", enabled: true, order: 5 },
    { key: "terms", label: "Terms", slug: "/terms", enabled: true, order: 6 },
  ],
  legal: { privacyUrl: "", termsUrl: "", riskDisclaimer: "", disclaimerText: "" },
});

const normalizeDraft = (value: Partial<WizardDraft>): WizardDraft => {
  const fallback = initialDraft();
  const navigation = Array.isArray(value.navigation) ? [...value.navigation] : [...fallback.navigation];
  for (const mandatory of fallback.navigation.filter(item => ["privacy", "terms", "free_bots"].includes(item.key))) {
    if (!navigation.some(item => item.key === mandatory.key)) navigation.push(mandatory);
  }
  return {
    ...fallback,
    ...value,
    commercial: { ...fallback.commercial, ...value.commercial },
    project: { ...fallback.project, ...value.project },
    deployment: { ...fallback.deployment, ...value.deployment },
    branding: { ...fallback.branding, ...value.branding },
    template: { ...fallback.template, ...value.template },
    deriv: { ...fallback.deriv, ...value.deriv },
    features: { ...fallback.features, ...value.features },
    bots: Array.isArray(value.bots) ? value.bots.map((bot, index) => ({ ...bot, category: "free", displayOrder: bot.displayOrder ?? index, isActive: bot.isActive ?? true })) : fallback.bots,
    legal: { ...fallback.legal, ...value.legal },
    navigation,
  };
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const phonePattern = /^(\+?254|0)?[17]\d{8}$/;

const validateDraft = (draft: WizardDraft): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const block = (code: string, message: string, field?: string) => issues.push({ code, message, field, severity: "blocking" });
  const warn = (code: string, message: string, field?: string) => issues.push({ code, message, field, severity: "warning" });

  if (draft.project.siteName.trim().length < 2) block("site_name_missing", "Site name is required.", "project.siteName");
  if (!emailPattern.test(draft.project.supportEmail)) block("support_email_invalid", "A valid support email is required.", "project.supportEmail");
  if (!hostnamePattern.test(draft.deployment.customDomain)) block("domain_invalid", "Enter a valid custom domain.", "deployment.customDomain");
  if (!draft.deriv.appId.trim()) block("deriv_app_id_missing", "Deriv App ID is required.", "deriv.appId");
  if (!draft.deriv.oauthClientId.trim()) block("oauth_client_missing", "Deriv OAuth client ID is required.", "deriv.oauthClientId");
  try {
    const callback = new URL(draft.deriv.callbackUri);
    const expected = draft.deployment.customDomain ? `https://${draft.deployment.customDomain.toLowerCase()}/api/deriv-oauth-callback` : "";
    if (callback.protocol !== "https:" || (expected && callback.toString() !== expected)) {
      block("callback_invalid", `Register and enter the exact callback URL: ${expected || "https://your-domain/api/deriv-oauth-callback"}`, "deriv.callbackUri");
    }
  } catch {
    block("callback_invalid", "The exact registered HTTPS callback URL is required.", "deriv.callbackUri");
  }
  if (!draft.branding.logoUrl) warn("logo_missing", "Add a logo before launch.", "branding.logoUrl");
  if (draft.bots.length === 0) warn("free_bots_empty", "No free bots have been imported yet.", "bots");
  if (!draft.legal.privacyUrl) block("privacy_missing", "Privacy policy URL is required.", "legal.privacyUrl");
  if (!draft.legal.termsUrl) block("terms_missing", "Terms URL is required.", "legal.termsUrl");
  if (!draft.legal.riskDisclaimer.trim()) block("risk_missing", "A risk disclaimer is required.", "legal.riskDisclaimer");
  if (!emailPattern.test(draft.commercial.paymentEmail)) block("payment_email_missing", "Payment email is required at the final step.", "commercial.paymentEmail");
  if (!phonePattern.test(draft.commercial.paymentPhone.replace(/\s+/g, "").replace(/-/g, ""))) block("payment_phone_missing", "A valid M-Pesa phone number is required at the final step.", "commercial.paymentPhone");
  if (!draft.commercial.acceptedTerms) block("payment_terms_missing", "Accept the selected payment terms before publishing.", "commercial.acceptedTerms");

  const markup = Number(draft.deriv.markupRate || 0);
  if (!Number.isFinite(markup) || markup < 0) block("markup_invalid", "Markup must be zero or a supported positive value.", "deriv.markupRate");
  for (const item of draft.navigation) {
    if (item.enabled && !item.slug.startsWith("/")) block("route_invalid", `${item.label} needs a route beginning with /.`, "navigation");
  }
  for (const requiredKey of ["privacy", "terms", "free_bots"]) {
    if (!draft.navigation.some(item => item.key === requiredKey && item.enabled)) block("mandatory_route_missing", `${requiredKey} must remain enabled.`, "navigation");
  }
  for (const feature of featureChoices.filter(item => item.status !== "ready")) {
    if (draft.features[feature.key]) block("feature_unavailable", `${feature.label} is not production-ready in this template.`, `features.${feature.key}`);
  }
  return issues;
};

const Field = ({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-medium text-foreground">{label}</span>
    {children}
    {help ? <span className="block text-xs leading-5 text-muted-foreground">{help}</span> : null}
  </label>
);

const SiteWizard = () => {
  const { siteId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<WizardDraft>(initialDraft);
  const [organisationId, setOrganisationId] = useState("");
  const [configurationId, setConfigurationId] = useState<string | null>(null);
  const [configurationVersion, setConfigurationVersion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const replayingPublish = useRef(false);
  const issues = useMemo(() => validateDraft(draft), [draft]);
  const displayIssues = step < 10 ? issues.filter(issue => !issue.field?.startsWith("commercial.")) : issues;
  const requiredScopes = useMemo(() => requiredScopesForFeatures(
    Object.entries(draft.features).filter(([, enabled]) => enabled).map(([key]) => key as DerivFeature)
  ), [draft.features]);
  const traderScopes = requiredScopes.filter(scope => scope !== "application_read");
  const ownerScopes = requiredScopes.filter(scope => scope === "application_read");
  const selectedPlan = draft.commercial.plan === "partnership_monthly"
    ? { title: "Partnership monthly", price: "17%", detail: "Monthly platform share after the site is live." }
    : { title: "One-time setup", price: "KES 25,000", detail: "Single setup payment collected at the final step." };

  useEffect(() => {
    if (!siteId || !user) return;
    (async () => {
      try {
        // Generated database types are refreshed only after the migration is applied.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { data: site, error } = await db.from("sites").select("*").eq("id", siteId).single();
        if (error) throw error;
        setOrganisationId(site.organisation_id);
        const { data: configuration } = await db.from("site_configurations").select("*").eq("site_id", siteId).in("status", ["draft", "invalid", "valid"]).order("version", { ascending: false }).limit(1).maybeSingle();
        if (configuration?.configuration) {
          setDraft(normalizeDraft(configuration.configuration));
          setConfigurationId(configuration.id);
          setConfigurationVersion(configuration.version);
          setStep(Math.min(configuration.wizard_step || 1, steps.length));
        } else {
          const [settings, domain, derivApp, bots, latestConfiguration] = await Promise.all([
            db.from("site_settings").select("*").eq("site_id", siteId).maybeSingle(),
            db.from("site_domains").select("*").eq("site_id", siteId).order("is_primary", { ascending: false }).limit(1).maybeSingle(),
            db.from("site_deriv_apps").select("*").eq("site_id", siteId).maybeSingle(),
            db.from("site_bots_manifest").select("*").eq("site_id", siteId).order("display_order", { ascending: true }),
            db.from("site_configurations").select("version").eq("site_id", siteId).order("version", { ascending: false }).limit(1).maybeSingle(),
          ]);
          setConfigurationVersion((latestConfiguration.data?.version || 0) + 1);
          setDraft(current => ({
            ...current,
            project: { ...current.project, siteName: settings.data?.site_name || site.name, internalName: site.internal_name || site.name, description: site.description || "", language: site.default_language || "en", region: site.target_region || "" },
            deployment: { ...current.deployment, customDomain: domain.data?.hostname || "" },
            branding: {
              ...current.branding,
              siteTitle: settings.data?.site_name || site.name,
              primaryColor: settings.data?.primary_color || current.branding.primaryColor,
              secondaryColor: settings.data?.secondary_color || current.branding.secondaryColor,
              accentColor: settings.data?.accent_color || current.branding.accentColor,
              logoUrl: settings.data?.logo_url || "",
              faviconUrl: settings.data?.favicon_url || "",
              surfaceColor: settings.data?.custom_css_vars_json?.["--site-surface"] || current.branding.surfaceColor,
              backgroundColor: settings.data?.custom_css_vars_json?.["--site-background"] || current.branding.backgroundColor,
              textColor: settings.data?.custom_css_vars_json?.["--site-text"] || current.branding.textColor,
            },
            deriv: { ...current.deriv, appId: derivApp.data?.deriv_app_id || "", oauthClientId: derivApp.data?.oauth_client_id || "", callbackUri: derivApp.data?.redirect_uri || "" },
            bots: (bots.data || []).map((bot: { id: string; bot_id?: string | null; display_name: string; description?: string | null; file_path?: string | null; category?: string | null; display_order?: number | null; is_active?: boolean | null }, index: number) => ({
              id: bot.bot_id || bot.id,
              name: bot.display_name,
              description: bot.description || "",
              fileName: bot.file_path?.split("/").pop() || `${bot.display_name}.xml`,
              filePath: bot.file_path || `free-bots/${bot.display_name}.xml`,
              category: "free",
              displayOrder: bot.display_order ?? index,
              isActive: bot.is_active ?? true,
            })),
          }));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load the site wizard");
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId, user]);

  const updateProject = (key: keyof WizardDraft["project"], value: string) => setDraft(current => ({ ...current, project: { ...current.project, [key]: value } }));
  const updateDeployment = (key: keyof WizardDraft["deployment"], value: string) => setDraft(current => ({ ...current, deployment: { ...current.deployment, [key]: value } }));
  const updateBranding = (key: keyof WizardDraft["branding"], value: string | boolean) => setDraft(current => ({ ...current, branding: { ...current.branding, [key]: value } }));
  const updateDeriv = (key: keyof WizardDraft["deriv"], value: string) => setDraft(current => ({ ...current, deriv: { ...current.deriv, [key]: value } }));
  const updateCommercial = (key: keyof WizardDraft["commercial"], value: string | boolean) => setDraft(current => ({ ...current, commercial: { ...current.commercial, [key]: value } }));
  const input = (value: string, onChange: (value: string) => void, type = "text") => <Input type={type} value={value} onChange={event => onChange(event.target.value)} />;

  const importBots = async (files: FileList | null) => {
    if (!files?.length) return;
    const imported = await Promise.all(Array.from(files).map(async (file, index) => {
      const xmlContent = await file.text();
      const name = file.name.replace(/\.(xml|txt)$/i, "").replace(/[-_]+/g, " ").trim() || file.name;
      return {
        id: `free-${crypto.randomUUID()}`,
        name,
        description: "Imported free bot",
        fileName: file.name,
        filePath: `free-bots/${file.name}`,
        xmlContent,
        category: "free" as const,
        displayOrder: draft.bots.length + index,
        isActive: true,
      };
    }));
    setDraft(current => ({
      ...current,
      bots: [...current.bots, ...imported],
      navigation: current.navigation.map(item => item.key === "free_bots" ? { ...item, enabled: true } : item),
    }));
    toast.success(`${imported.length} bot${imported.length === 1 ? "" : "s"} imported for Free Bots`);
  };

  const saveDraft = async (nextStep = step, draftToSave = draft) => {
    if (!user || !organisationId) throw new Error("Site access is not available");
    setSaving(true);
    try {
      // Generated database types are refreshed only after the migration is applied.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const draftIssues = validateDraft(draftToSave);
      const draftScopes = requiredScopesForFeatures(Object.entries(draftToSave.features).filter(([, enabled]) => enabled).map(([key]) => key as DerivFeature));
      const payload = {
        organisation_id: organisationId,
        site_id: siteId,
        version: configurationVersion,
        schema_version: 1,
        template_id: draftToSave.template.id,
        template_version: draftToSave.template.version,
        status: draftIssues.some(issue => issue.severity === "blocking") ? "invalid" : "valid",
        wizard_step: nextStep,
        configuration: draftToSave,
        validation_result: { blocking: draftIssues.filter(issue => issue.severity === "blocking"), warnings: draftIssues.filter(issue => issue.severity === "warning"), checkedAt: new Date().toISOString() },
        created_by: user.id,
      };
      const query = configurationId
        ? db.from("site_configurations").update(payload).eq("id", configurationId)
        : db.from("site_configurations").insert(payload);
      const { data, error } = await query.select("id, version").single();
      if (error) throw error;
      setConfigurationId(data.id);
      setConfigurationVersion(data.version);
      const writes = [
        db.from("sites").update({ name: draftToSave.project.siteName.trim(), internal_name: draftToSave.project.internalName.trim(), description: draftToSave.project.description.trim(), default_language: draftToSave.project.language, target_region: draftToSave.project.region || null, configuration_status: payload.status }).eq("id", siteId),
        db.from("site_settings").upsert({
          site_id: siteId,
          site_name: draftToSave.branding.siteTitle || draftToSave.project.siteName,
          brand_name: draftToSave.project.siteName,
          logo_url: draftToSave.branding.logoUrl || null,
          favicon_url: draftToSave.branding.faviconUrl || null,
          primary_color: draftToSave.branding.primaryColor,
          secondary_color: draftToSave.branding.secondaryColor,
          accent_color: draftToSave.branding.accentColor,
          custom_css_vars_json: {
            "--site-background": draftToSave.branding.backgroundColor,
            "--site-surface": draftToSave.branding.surfaceColor,
            "--site-text": draftToSave.branding.textColor,
            "--site-radius": draftToSave.branding.borderRadius,
          },
        }, { onConflict: "site_id" }),
        db.from("site_deriv_apps").upsert({ site_id: siteId, deriv_app_id: draftToSave.deriv.appId || null, oauth_client_id: draftToSave.deriv.oauthClientId || null, redirect_uri: draftToSave.deriv.callbackUri || null, use_legacy_oauth_login: false, include_legacy_app_id_in_oauth: false }, { onConflict: "site_id" }),
      ];
      if (draftToSave.deployment.customDomain.trim()) {
        writes.push(db.from("site_domains").upsert({ site_id: siteId, hostname: draftToSave.deployment.customDomain.trim().toLowerCase(), is_primary: true }, { onConflict: "hostname" }));
      }
      if (draftToSave.deriv.appId.trim() && draftToSave.deriv.oauthClientId.trim() && draftToSave.deriv.callbackUri.trim()) {
        writes.push(db.from("deriv_applications").upsert({ organisation_id: organisationId, site_id: siteId, app_id: draftToSave.deriv.appId.trim(), oauth_client_id: draftToSave.deriv.oauthClientId.trim(), callback_uri: draftToSave.deriv.callbackUri.trim(), environment: draftToSave.deriv.environment, configured_scopes: draftScopes, markup_rate: draftToSave.deriv.markupRate ? Number(draftToSave.deriv.markupRate) : null, verification_status: "configured" }, { onConflict: "site_id" }));
      }
      const results = await Promise.all(writes);
      const failedWrite = results.find(result => result.error);
      if (failedWrite?.error) throw failedWrite.error;
      await db.from("site_bots_manifest").delete().eq("site_id", siteId);
      if (draftToSave.bots.length) {
        const botRows = draftToSave.bots.map((bot, index) => ({
          site_id: siteId,
          bot_id: bot.id,
          display_name: bot.name,
          description: bot.description || null,
          file_path: bot.filePath,
          category: "free",
          display_order: index,
          is_active: bot.isActive,
        }));
        const { error: botsError } = await db.from("site_bots_manifest").insert(botRows);
        if (botsError) throw botsError;
      }
      if (draftToSave.deployment.customDomain.trim()) {
        const { error: demoteError } = await db.from("site_domains").update({ is_primary: false }).eq("site_id", siteId).neq("hostname", draftToSave.deployment.customDomain.trim().toLowerCase());
        if (demoteError) throw demoteError;
      }
      toast.success("Draft saved");
    } finally {
      setSaving(false);
    }
  };

  const publishQueueKey = `reef:queued-publish:${siteId}`;
  const invokePublish = async () => {
    const { data, error } = await supabase.functions.invoke("publish-site-to-github", { body: { siteId } });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Publishing failed");
  };

  const publish = async () => {
    const blocking = issues.filter(issue => issue.severity === "blocking");
    if (blocking.length) {
      toast.error(`Resolve ${blocking.length} blocking validation issue${blocking.length === 1 ? "" : "s"}.`);
      setStep(9);
      return;
    }
    try {
      await saveDraft(10);
      await invokePublish();
      localStorage.removeItem(publishQueueKey);
      toast.success("Configuration committed. Netlify is building the site.");
      navigate(`/sites/${siteId}/config`);
    } catch (error) {
      if (!navigator.onLine || (error instanceof Error && /fetch|network|offline/i.test(`${error.name} ${error.message}`))) {
        localStorage.setItem(publishQueueKey, JSON.stringify({ draft, queuedAt: new Date().toISOString() }));
        toast.info("Update queued on this device. Reopen Site Manager after reconnecting and it will publish automatically.");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Publishing failed");
    }
  };

  useEffect(() => {
    if (loading || !user || !organisationId || !siteId) return;
    const replay = async () => {
      if (replayingPublish.current || !navigator.onLine) return;
      const raw = localStorage.getItem(publishQueueKey);
      if (!raw) return;
      replayingPublish.current = true;
      try {
        const queued = JSON.parse(raw) as { draft?: Partial<WizardDraft> };
        const queuedDraft = normalizeDraft(queued.draft || {});
        if (validateDraft(queuedDraft).some(issue => issue.severity === "blocking")) {
          localStorage.removeItem(publishQueueKey);
          setDraft(queuedDraft);
          setStep(9);
          toast.error("The queued update needs review before it can be published.");
          return;
        }
        setDraft(queuedDraft);
        await saveDraft(10, queuedDraft);
        await invokePublish();
        localStorage.removeItem(publishQueueKey);
        toast.success("Queued update committed after connectivity returned.");
        navigate(`/sites/${siteId}/config`);
      } catch (error) {
        if (navigator.onLine) toast.error(error instanceof Error ? error.message : "Queued publishing failed");
      } finally {
        replayingPublish.current = false;
      }
    };
    window.addEventListener("online", replay);
    if (navigator.onLine) void replay();
    return () => window.removeEventListener("online", replay);
    // Replay is intentionally bound after the remote draft and tenant context load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, organisationId, siteId, configurationId]);

  const connectOwnerDeriv = async () => {
    try {
      if (!draft.features.markup_statistics) {
        toast.error("Enable Markup statistics before connecting reporting.");
        setStep(6);
        return;
      }
      await saveDraft(step);
      const { data, error } = await supabase.functions.invoke("deriv-owner-oauth-start", {
        body: { siteId, scopes: ["application_read"], returnPath: `/sites/${siteId}/wizard` },
      });
      if (error || !data?.authorizationUrl) throw new Error(data?.error?.message || error?.message || "Unable to start Deriv connection");
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to connect Deriv");
    }
  };

  if (loading) return <div className="flex-1 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin" /></div>;

  return (
    <div className="flex-1 bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Customer site wizard</h1>
              <p className="mt-1 text-sm text-slate-500">Version {configurationVersion}. Build the site first, collect payment at the end, then publish to GitHub and Netlify.</p>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <span className="text-slate-500">Selected plan</span>
            <div className="font-semibold text-slate-950">{selectedPlan.title} · {selectedPlan.price}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[250px_1fr]">
          <aside className="space-y-2">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = step === index + 1;
              return (
                <button
                  key={item.label}
                  onClick={() => setStep(index + 1)}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left text-sm transition ${active ? "border-sky-500 bg-white text-slate-950 shadow-sm" : index + 1 < step ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500 hover:text-slate-950"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </aside>

          <main className="min-h-[620px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {step === 1 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Choose how this site pays</h2>
                  <p className="mt-1 text-sm text-slate-500">Every customer chooses one of these two models, and payment is handled after configuration review.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { key: "partnership_monthly" as const, title: "Partnership monthly", price: "17%", caption: "Monthly platform share", points: ["Lower entry cost", "Good for testing a new community", "Pay after the website setup is ready"] },
                    { key: "one_time" as const, title: "One-time setup", price: "KES 25,000", caption: "Single payment", points: ["No monthly platform percentage", "Best for established traders", "Payment still happens at the final step"] },
                  ].map(plan => (
                    <button
                      key={plan.key}
                      onClick={() => updateCommercial("plan", plan.key)}
                      className={`rounded-lg border p-5 text-left transition ${draft.commercial.plan === plan.key ? "border-sky-500 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-950">{plan.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{plan.caption}</p>
                        </div>
                        <div className="text-2xl font-semibold text-slate-950">{plan.price}</div>
                      </div>
                      <ul className="mt-5 space-y-2">
                        {plan.points.map(point => (
                          <li key={point} className="flex items-center gap-2 text-sm text-slate-600"><Check className="h-4 w-4 text-emerald-600" />{point}</li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Name the business</h2>
                  <p className="mt-1 text-sm text-slate-500">This becomes the public identity for the customer site and the internal record for your manager.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Site name">{input(draft.project.siteName, value => updateProject("siteName", value))}</Field>
                  <Field label="Internal project name">{input(draft.project.internalName, value => updateProject("internalName", value))}</Field>
                  <Field label="Owner or organisation">{input(draft.project.organisationName, value => updateProject("organisationName", value))}</Field>
                  <Field label="Support email">{input(draft.project.supportEmail, value => updateProject("supportEmail", value), "email")}</Field>
                  <Field label="Support contact">{input(draft.project.supportContact, value => updateProject("supportContact", value))}</Field>
                  <Field label="Default language">{input(draft.project.language, value => updateProject("language", value))}</Field>
                  <Field label="Target region">{input(draft.project.region, value => updateProject("region", value))}</Field>
                </div>
                <Field label="Description"><textarea className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={draft.project.description} onChange={event => updateProject("description", event.target.value)} /></Field>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Set colors and preview</h2>
                    <p className="mt-1 text-sm text-slate-500">Pick the public theme before domain setup so the user sees the brand taking shape early.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {(["primaryColor", "secondaryColor", "accentColor", "backgroundColor", "surfaceColor", "textColor"] as const).map(key => (
                      <Field key={key} label={key.replace(/([A-Z])/g, " $1")}>
                        <div className="flex gap-2">
                          <Input type="color" className="h-10 w-14 p-1" value={draft.branding[key]} onChange={event => updateBranding(key, event.target.value)} />
                          {input(draft.branding[key], value => updateBranding(key, value))}
                        </div>
                      </Field>
                    ))}
                    <Field label="Site title">{input(draft.branding.siteTitle, value => updateBranding("siteTitle", value))}</Field>
                    <Field label="Logo URL">{input(draft.branding.logoUrl, value => updateBranding("logoUrl", value))}</Field>
                    <Field label="Typography">{input(draft.branding.typography, value => updateBranding("typography", value))}</Field>
                    <Field label="Border radius">{input(draft.branding.borderRadius, value => updateBranding("borderRadius", value))}</Field>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                    <span className="text-sm">Show Powered by Deriv attribution</span>
                    <Switch checked={draft.branding.poweredByDeriv} onCheckedChange={value => updateBranding("poweredByDeriv", value)} />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <div
                    className="overflow-hidden rounded-md border"
                    style={{ backgroundColor: draft.branding.backgroundColor, color: draft.branding.textColor, borderRadius: draft.branding.borderRadius }}
                  >
                    <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: draft.branding.surfaceColor }}>
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-md text-sm font-semibold text-white" style={{ backgroundColor: draft.branding.primaryColor }}>
                          {(draft.project.siteName || "S").slice(0, 1)}
                        </div>
                        <span className="font-semibold">{draft.branding.siteTitle || draft.project.siteName || "Trader site"}</span>
                      </div>
                      <span className="rounded px-2 py-1 text-xs text-white" style={{ backgroundColor: draft.branding.accentColor }}>Live</span>
                    </div>
                    <div className="space-y-4 p-5">
                      <h3 className="text-2xl font-semibold">Free bots for your traders</h3>
                      <p className="text-sm opacity-75">Imported bots appear here, with your colors applied across buttons, badges and panels.</p>
                      <div className="grid gap-3">
                        {(draft.bots.length ? draft.bots.slice(0, 2) : [{ name: "Rise Fall Starter", description: "Example free bot" }, { name: "Volatility Scout", description: "Example free bot" }]).map(bot => (
                          <div key={bot.name} className="rounded-md border p-3" style={{ backgroundColor: draft.branding.surfaceColor }}>
                            <p className="font-medium">{bot.name}</p>
                            <p className="text-xs opacity-70">{bot.description}</p>
                          </div>
                        ))}
                      </div>
                      <button className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: draft.branding.primaryColor }}>Open bot builder</button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Choose the trading template</h2>
                  <p className="mt-1 text-sm text-slate-500">Templates decide which runtime and public pages the customer site receives.</p>
                </div>
                <div className="grid gap-4">
                  {TEMPLATE_REGISTRY.map(template => (
                    <button key={`${template.id}:${template.version}`} onClick={() => setDraft(current => ({ ...current, template: { id: template.id, version: template.version } }))} className={`rounded-lg border p-5 text-left ${draft.template.id === template.id ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <strong>{template.name}</strong>
                        <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium uppercase text-emerald-700">{template.releaseStatus}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{template.description}</p>
                      <p className="mt-3 text-xs text-slate-500">Version {template.version} · {template.supportedTradeTypes.join(", ")}</p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 5 ? (
              <section className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Import free bots</h2>
                    <p className="mt-1 text-sm text-slate-500">Upload XML bot files here. They are added to the Free Bots page in the customer site configuration.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                    <Upload className="h-4 w-4" />
                    Import XML
                    <input type="file" accept=".xml,.txt" multiple className="hidden" onChange={event => void importBots(event.target.files)} />
                  </label>
                </div>
                <div className="grid gap-3">
                  {draft.bots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No bots imported yet. Import XML files to populate the Free Bots page.</div>
                  ) : draft.bots.map((bot, index) => (
                    <div key={bot.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[auto_1fr_1fr_auto] md:items-center">
                      <Switch checked={bot.isActive} onCheckedChange={isActive => setDraft(current => ({ ...current, bots: current.bots.map(row => row.id === bot.id ? { ...row, isActive } : row) }))} />
                      <Input value={bot.name} onChange={event => setDraft(current => ({ ...current, bots: current.bots.map(row => row.id === bot.id ? { ...row, name: event.target.value } : row) }))} />
                      <Input value={bot.description} onChange={event => setDraft(current => ({ ...current, bots: current.bots.map(row => row.id === bot.id ? { ...row, description: event.target.value } : row) }))} />
                      <Button variant="ghost" onClick={() => setDraft(current => ({ ...current, bots: current.bots.filter(row => row.id !== bot.id).map((row, rowIndex) => ({ ...row, displayOrder: rowIndex })) }))}>Remove</Button>
                      <span className="text-xs text-slate-500 md:col-start-2">Free Bots position {index + 1} · {bot.fileName}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 6 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Deriv app and trading tools</h2>
                  <p className="mt-1 text-sm text-slate-500">Select only the tools the site needs. Required Deriv scopes update automatically.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Deriv App ID">{input(draft.deriv.appId, value => updateDeriv("appId", value))}</Field>
                  <Field label="OAuth client ID">{input(draft.deriv.oauthClientId, value => updateDeriv("oauthClientId", value))}</Field>
                  <Field label="Environment">
                    <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={draft.deriv.environment} onChange={event => updateDeriv("environment", event.target.value)}>
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                    </select>
                  </Field>
                  <Field label="Trade markup">{input(draft.deriv.markupRate, value => updateDeriv("markupRate", value), "number")}</Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {featureChoices.map(feature => (
                    <div key={feature.key} className="flex justify-between gap-3 rounded-lg border border-slate-200 p-4">
                      <div>
                        <div className="font-medium text-slate-950">{feature.label} <span className={`ml-2 text-[10px] uppercase ${feature.status === "ready" ? "text-emerald-600" : "text-amber-600"}`}>{feature.status}</span></div>
                        <p className="mt-1 text-xs text-slate-500">{SCOPE_REGISTRY[feature.key].reason}</p>
                        <p className="mt-2 text-xs text-slate-500">Scope: {SCOPE_REGISTRY[feature.key].requiredScopes.join(", ") || "none"}</p>
                      </div>
                      <Switch checked={draft.features[feature.key]} disabled={feature.status !== "ready"} onCheckedChange={enabled => setDraft(current => ({ ...current, features: { ...current.features, [feature.key]: enabled } }))} />
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-slate-200 p-4 text-sm">
                  <p>Trader login scopes: <span className="font-medium text-slate-950">{traderScopes.join(" ") || "none"}</span></p>
                  <p className="mt-1">Owner reporting scopes: <span className="font-medium text-slate-950">{ownerScopes.join(" ") || "not required"}</span></p>
                </div>
                <div className="rounded-md border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Markup reporting identity</p>
                      <p className="text-xs text-slate-500">Connect with application_read. The token is encrypted server-side.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={connectOwnerDeriv}>Connect Deriv reporting</Button>
                  </div>
                  {draft.features.markup_statistics ? <AdminMarkupStats enabled={step === 6} siteId={siteId} adminMode={false} title="Your site markup" /> : null}
                </div>
              </section>
            ) : null}

            {step === 7 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Domain and callback</h2>
                  <p className="mt-1 text-sm text-slate-500">Domain setup comes after branding and bots so the user knows what they are launching before DNS work starts.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Temporary subdomain">{input(draft.deployment.subdomain, value => updateDeployment("subdomain", value))}</Field>
                  <Field label="Custom domain">{input(draft.deployment.customDomain, value => updateDeployment("customDomain", value.toLowerCase()))}</Field>
                  <Field label="Production branch">{input(draft.deployment.branch, value => updateDeployment("branch", value))}</Field>
                  <Field label="Output directory">{input(draft.deployment.outputDirectory, value => updateDeployment("outputDirectory", value))}</Field>
                  <Field label="Exact registered callback URL" help={`Register https://${draft.deployment.customDomain || "your-domain"}/api/deriv-oauth-callback in Deriv.`}>{input(draft.deriv.callbackUri, value => updateDeriv("callbackUri", value))}</Field>
                  <Field label="Provider">{input("Netlify", () => {})}</Field>
                </div>
              </section>
            ) : null}

            {step === 8 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Legal pages and navigation</h2>
                  <p className="mt-1 text-sm text-slate-500">Free Bots, privacy and terms stay enabled because they are part of the public site contract.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Privacy policy URL">{input(draft.legal.privacyUrl, value => setDraft(current => ({ ...current, legal: { ...current.legal, privacyUrl: value } })))}</Field>
                  <Field label="Terms URL">{input(draft.legal.termsUrl, value => setDraft(current => ({ ...current, legal: { ...current.legal, termsUrl: value } })))}</Field>
                </div>
                <Field label="Risk disclaimer"><textarea className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={draft.legal.riskDisclaimer} onChange={event => setDraft(current => ({ ...current, legal: { ...current.legal, riskDisclaimer: event.target.value } }))} /></Field>
                <div className="grid gap-3">
                  {draft.navigation.map((item, index) => (
                    <div key={item.key} className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 rounded-md border border-slate-200 p-3">
                      <Switch checked={item.enabled} disabled={["privacy", "terms", "free_bots"].includes(item.key)} onCheckedChange={enabled => setDraft(current => ({ ...current, navigation: current.navigation.map((row, rowIndex) => rowIndex === index ? { ...row, enabled } : row) }))} />
                      <Input value={item.label} onChange={event => setDraft(current => ({ ...current, navigation: current.navigation.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row) }))} />
                      <Input value={item.slug} onChange={event => setDraft(current => ({ ...current, navigation: current.navigation.map((row, rowIndex) => rowIndex === index ? { ...row, slug: event.target.value } : row) }))} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 9 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Review before payment</h2>
                  <p className="mt-1 text-sm text-slate-500">Everything is configured first. Payment comes next, then publish commits to GitHub.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border border-slate-200 p-4"><span className="text-xs text-slate-500">Plan</span><p className="font-medium">{selectedPlan.price}</p></div>
                  <div className="rounded-md border border-slate-200 p-4"><span className="text-xs text-slate-500">Bots</span><p className="font-medium">{draft.bots.filter(bot => bot.isActive).length} active</p></div>
                  <div className="rounded-md border border-slate-200 p-4"><span className="text-xs text-slate-500">Scopes</span><p className="font-medium">{requiredScopes.length || "None"}</p></div>
                  <div className="rounded-md border border-slate-200 p-4"><span className="text-xs text-slate-500">Domain</span><p className="font-medium">{draft.deployment.customDomain || "Not set"}</p></div>
                </div>
                <div className="space-y-2">
                  {displayIssues.length === 0 ? <div className="flex gap-2 text-emerald-700"><Check className="h-4 w-4" />Configuration checks passed. Continue to payment.</div> : null}
                  {displayIssues.map(issue => <div key={`${issue.code}:${issue.field}`} className={`flex gap-2 rounded-md border p-3 text-sm ${issue.severity === "blocking" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}><AlertCircle className="h-4 w-4 shrink-0" />{issue.message}</div>)}
                </div>
              </section>
            ) : null}

            {step === 10 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Payment and publish</h2>
                  <p className="mt-1 text-sm text-slate-500">Collect the selected payment details now. After this, publishing creates the GitHub commit and Netlify deploy.</p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{selectedPlan.title}</p>
                      <p className="text-sm text-slate-600">{selectedPlan.detail}</p>
                    </div>
                    <div className="text-3xl font-semibold text-slate-950">{selectedPlan.price}</div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Payment email">{input(draft.commercial.paymentEmail, value => updateCommercial("paymentEmail", value), "email")}</Field>
                  <Field label="M-Pesa phone number">{input(draft.commercial.paymentPhone, value => updateCommercial("paymentPhone", value), "tel")}</Field>
                </div>
                <label className="flex items-start gap-3 rounded-md border border-slate-200 p-4 text-sm">
                  <input type="checkbox" checked={draft.commercial.acceptedTerms} onChange={event => updateCommercial("acceptedTerms", event.target.checked)} className="mt-1" />
                  <span>I confirm the customer has accepted the {selectedPlan.title.toLowerCase()} payment terms and the site should be published after payment confirmation.</span>
                </label>
                <div className="space-y-2">
                  {issues.map(issue => <div key={`${issue.code}:${issue.field}`} className={`flex gap-2 rounded-md border p-3 text-sm ${issue.severity === "blocking" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}><AlertCircle className="h-4 w-4 shrink-0" />{issue.message}</div>)}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => saveDraft(10)} variant="outline"><Save className="mr-2 h-4 w-4" />Save payment state</Button>
                  <Button onClick={publish} disabled={saving || issues.some(issue => issue.severity === "blocking")}><CreditCard className="mr-2 h-4 w-4" />Publish after payment</Button>
                  <Button variant="ghost" onClick={() => navigate(`/sites/${siteId}/config`)}>Deployment status</Button>
                </div>
              </section>
            ) : null}
          </main>
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(value => Math.max(1, value - 1))}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={saving} onClick={() => saveDraft(step)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span className="ml-2">Save draft</span></Button>
            {step < steps.length ? <Button onClick={async () => { await saveDraft(step + 1); setStep(value => Math.min(steps.length, value + 1)); }}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteWizard;
