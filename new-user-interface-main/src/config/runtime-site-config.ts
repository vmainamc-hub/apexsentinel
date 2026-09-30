export type RuntimeTool = {
    key: string;
    name: string;
    enabled: boolean;
    version: string;
    displayOrder: number;
    settings?: Record<string, unknown>;
};

export type RuntimeSiteConfig = {
    schemaVersion: number;
    version?: number;
    generatedAt?: string;
    tenantId: string;
    template: { id: string; version: string };
    site: { id: string; name: string; hostname: string };
    branding: {
        brandName: string;
        logoUrl?: string;
        faviconUrl?: string;
        darkModeDefault?: boolean;
        theme?: {
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
        requiredScopes?: Array<'trade' | 'account_manage' | 'payment' | 'application_read'>;
        environment?: 'staging' | 'production';
    };
    features?: Record<string, boolean>;
    pages?: Array<{ key: string; label?: string; enabled: boolean; order: number }>;
    navigation?: Array<{ key: string; label: string; slug: string; enabled: boolean; order: number; externalUrl?: string; placement?: 'header' | 'footer' | 'both' }>;
    legal?: { privacyUrl?: string; termsUrl?: string; riskDisclaimer?: string; disclaimerText?: string };
    bots?: Array<{ id?: string; name: string; filePath?: string; displayOrder?: number; isActive?: boolean }>;
    tools?: RuntimeTool[];
};

let runtimeConfig: RuntimeSiteConfig | null = null;
let loadError: Error | null = null;

const isRuntimeConfig = (value: unknown): value is RuntimeSiteConfig => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<RuntimeSiteConfig>;
    return Boolean(
        candidate.schemaVersion &&
            candidate.tenantId &&
            candidate.template?.id &&
            candidate.site?.id &&
            candidate.branding?.brandName &&
            candidate.deriv?.gatewayUrl
    );
};

const fetchJson = async (url: string) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
    if (!response.ok) throw new Error(`Site configuration request failed (${response.status})`);
    const value: unknown = await response.json();
    if (!isRuntimeConfig(value)) throw new Error('Site configuration response is invalid');
    return value;
};

export const initializeRuntimeSiteConfig = async (): Promise<RuntimeSiteConfig | null> => {
    const staticConfigUrl = process.env.REEF_SITE_CONFIG_URL || '/site.config.json';
    const apiBase = process.env.SITE_CONFIG_API_BASE_URL?.replace(/\/$/, '');
    const hostname = window.location.hostname.replace(/\.$/, '').toLowerCase();

    try {
        runtimeConfig = await fetchJson(staticConfigUrl);
        return runtimeConfig;
    } catch (staticError) {
        if (apiBase) {
            try {
                runtimeConfig = await fetchJson(
                    `${apiBase}/public-site-config?hostname=${encodeURIComponent(hostname)}`
                );
                return runtimeConfig;
            } catch (remoteError) {
                loadError = remoteError instanceof Error ? remoteError : new Error('Remote site configuration failed');
            }
        } else {
            loadError = staticError instanceof Error ? staticError : new Error('Static site configuration failed');
        }
    }

    console.error('[Site config] No valid runtime configuration is available:', loadError?.message);
    return null;
};

export const getRuntimeSiteConfig = () => runtimeConfig;
export const getRuntimeSiteConfigError = () => loadError;

export const isRuntimeToolEnabled = (key: string, fallback = false) => {
    const configuredTool = runtimeConfig?.tools?.find(tool => tool.key === key);
    if (configuredTool) return configuredTool.enabled;
    return runtimeConfig?.features?.[key] ?? fallback;
};
