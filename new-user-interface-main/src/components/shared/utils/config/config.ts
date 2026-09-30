import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { getRuntimeSiteConfig } from '@/config/runtime-site-config';
import brandConfig from '../../../../../brand.config.json';

// =============================================================================
// Domain Configuration Map
// Maps each hostname to its specific Deriv APP_ID, OAuth CLIENT_ID, and the
// exact redirect URI registered in that OAuth app. Add a new entry here to
// support an additional domain — no other code changes required.
// =============================================================================

type DomainFeatureFlags = {
    botIdeas: boolean;
    scanner: boolean;
    printPopups: boolean;
    autoTrades: boolean;
    comboTrades: boolean;
    chart: boolean;
    tutorials: boolean;
};

type DomainUIConfig = {
    brandName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoUrl: string;
    faviconUrl: string;
    headerBgColor: string;
    headerTextColor: string;
    sidebarBgColor: string;
    sidebarTextColor: string;
    buttonPrimaryBg: string;
    buttonPrimaryText: string;
    buttonSecondaryBg: string;
    buttonSecondaryText: string;
    cardBgColor: string;
    cardBorderColor: string;
    textPrimary: string;
    textSecondary: string;
    successColor: string;
    errorColor: string;
    warningColor: string;
    fontFamily: string;
    borderRadius: string;
    showHeaderLogo: boolean;
    showHeaderTitle: boolean;
    showFooter: boolean;
    showDisclaimer: boolean;
    customCssVars: Record<string, string>;
};

interface DomainConfig {
    clientId: string;
    appId: string;
    redirectUri: string;
    botsFolder: string;
    features: DomainFeatureFlags;
    ui: DomainUIConfig;
}

const DEFAULT_BOTS_FOLDER = 'optimumtraders.site';
const DEFAULT_DOMAIN_FEATURES: DomainFeatureFlags = {
    botIdeas: true,
    scanner: true,
    printPopups: true,
    autoTrades: true,
    comboTrades: false,
    chart: true,
    tutorials: true,
};

const DEFAULT_DOMAIN_UI: DomainUIConfig = {
    brandName: 'Deriv Bot',
    primaryColor: '#f97316',
    secondaryColor: '#1a1a2e',
    accentColor: '#2196f3',
    logoUrl: '',
    faviconUrl: '',
    headerBgColor: '#1a1a2e',
    headerTextColor: '#ffffff',
    sidebarBgColor: '#16213e',
    sidebarTextColor: '#e0e0e0',
    buttonPrimaryBg: '#f97316',
    buttonPrimaryText: '#ffffff',
    buttonSecondaryBg: '#2d2d44',
    buttonSecondaryText: '#e0e0e0',
    cardBgColor: '#1e1e32',
    cardBorderColor: '#2d2d44',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0b0',
    successColor: '#4caf50',
    errorColor: '#f44336',
    warningColor: '#ff9800',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    borderRadius: '8px',
    showHeaderLogo: true,
    showHeaderTitle: true,
    showFooter: true,
    showDisclaimer: true,
    customCssVars: {},
};

// Production sites are configured exclusively by versioned runtime config.
export const DOMAIN_CONFIG: Record<string, DomainConfig> = {};

export const getDomainConfigForHost = (hostname: string): DomainConfig | undefined => DOMAIN_CONFIG[hostname];

/**
 * Returns the DomainConfig for the current hostname.
 * Falls back to env vars (for local / Replit dev) when the hostname is not
 * listed in DOMAIN_CONFIG.
 */
export const getDomainConfig = (): DomainConfig => {
    const runtime = getRuntimeSiteConfig();
    if (runtime) {
        const theme = runtime.branding.theme || {};
        const enabled = (key: string, fallback: boolean) => {
            const tool = runtime.tools?.find(item => item.key === key);
            const aliases: Record<string, string> = {
                bot_ideas: 'botIdeas',
                print_popups: 'printPopups',
                auto_trades: 'autoTrades',
                combo_trades: 'comboTrades',
                manual_trading: 'manualTrading',
                best_bots: 'bestBots',
                copy_trading: 'copyTrading',
                percentage_tool: 'percentageTool',
            };
            return tool?.enabled ?? runtime.features?.[key] ?? runtime.features?.[aliases[key]] ?? fallback;
        };
        return {
            clientId: runtime.deriv.oauthClientId || '',
            appId: runtime.deriv.appId || process.env.APP_ID || '',
            redirectUri: window.location.origin,
            botsFolder: runtime.site.id,
            features: {
                botIdeas: enabled('bot_ideas', true),
                scanner: enabled('scanner', true),
                printPopups: enabled('print_popups', false),
                autoTrades: enabled('auto_trades', true),
                comboTrades: enabled('combo_trades', false),
                chart: enabled('chart', true),
                tutorials: enabled('tutorials', true),
            },
            ui: {
                ...DEFAULT_DOMAIN_UI,
                brandName: runtime.branding.brandName,
                primaryColor: theme.primaryColor || DEFAULT_DOMAIN_UI.primaryColor,
                secondaryColor: theme.secondaryColor || DEFAULT_DOMAIN_UI.secondaryColor,
                accentColor: theme.accentColor || DEFAULT_DOMAIN_UI.accentColor,
                logoUrl: runtime.branding.logoUrl || '',
                faviconUrl: runtime.branding.faviconUrl || '',
                headerBgColor: theme.headerBgColor || DEFAULT_DOMAIN_UI.headerBgColor,
                headerTextColor: theme.headerTextColor || DEFAULT_DOMAIN_UI.headerTextColor,
                customCssVars: runtime.branding.customCssVars || {},
            },
        };
    }
    const hostname = window.location.hostname;
    const domain_config = getDomainConfigForHost(hostname);
    if (domain_config) {
        return domain_config;
    }
    // Fallback — used on localhost and Replit dev domains
    return {
        clientId: process.env.CLIENT_ID || '',
        appId: process.env.APP_ID || '',
        redirectUri: process.env.REDIRECT_URI || window.location.origin,
        botsFolder: process.env.BOTS_FOLDER || DEFAULT_BOTS_FOLDER,
        features: DEFAULT_DOMAIN_FEATURES,
        ui: DEFAULT_DOMAIN_UI,
    };
};

/**
 * Returns the registered production hostname for the current domain.
 * Used when we need to know which domain is active in production.
 */
export const getCurrentProductionDomain = () =>
    Object.keys(DOMAIN_CONFIG).find(domain => window.location.hostname === domain);

export const getBestBotsFolder = () => getDomainConfig().botsFolder;

export const getDomainFeatures = () => getDomainConfig().features;

export const isDomainFeatureEnabled = (feature: keyof DomainFeatureFlags) => getDomainFeatures()[feature];

export const getDomainUIConfig = (): DomainUIConfig => getDomainConfig().ui;

export const applyDomainUI = (): void => {
    const ui = getDomainUIConfig();
    const root = document.documentElement;
    root.style.setProperty('--domain-primary', ui.primaryColor);
    root.style.setProperty('--domain-secondary', ui.secondaryColor);
    root.style.setProperty('--domain-accent', ui.accentColor);
    root.style.setProperty('--domain-header-bg', ui.headerBgColor);
    root.style.setProperty('--domain-header-text', ui.headerTextColor);
    root.style.setProperty('--domain-sidebar-bg', ui.sidebarBgColor);
    root.style.setProperty('--domain-sidebar-text', ui.sidebarTextColor);
    root.style.setProperty('--domain-btn-primary-bg', ui.buttonPrimaryBg);
    root.style.setProperty('--domain-btn-primary-text', ui.buttonPrimaryText);
    root.style.setProperty('--domain-btn-secondary-bg', ui.buttonSecondaryBg);
    root.style.setProperty('--domain-btn-secondary-text', ui.buttonSecondaryText);
    root.style.setProperty('--domain-card-bg', ui.cardBgColor);
    root.style.setProperty('--domain-card-border', ui.cardBorderColor);
    root.style.setProperty('--domain-text-primary', ui.textPrimary);
    root.style.setProperty('--domain-text-secondary', ui.textSecondary);
    root.style.setProperty('--domain-success', ui.successColor);
    root.style.setProperty('--domain-error', ui.errorColor);
    root.style.setProperty('--domain-warning', ui.warningColor);
    root.style.setProperty('--domain-font-family', ui.fontFamily);
    root.style.setProperty('--domain-border-radius', ui.borderRadius);
    Object.entries(ui.customCssVars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
    if (ui.brandName) {
        document.title = ui.brandName;
    }
    if (ui.faviconUrl) {
        let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.href = ui.faviconUrl;
    }
};

export const buildBestBotsFileUrl = (bots_folder: string, file_name: string) => {
    const folder = encodeURI(bots_folder);
    return `/${folder}/${encodeURIComponent(file_name)}`;
};

export const getBestBotsFileUrl = (file_name: string) => buildBestBotsFileUrl(getBestBotsFolder(), file_name);

// =============================================================================
// Constants - Server Configuration (from brand.config.json)
// =============================================================================

// WebSocket server URLs
export const WS_SERVERS = {
    STAGING: `${brandConfig.platform.derivws.url.staging}options/ws/public`,
    PRODUCTION: `${brandConfig.platform.derivws.url.production}options/ws/public`,
} as const;

// Legacy — kept for backward-compat with imports elsewhere
export const PRODUCTION_DOMAINS = {
    COM: brandConfig.platform.hostname.production.com,
} as const;

export const STAGING_DOMAINS = {
    COM: brandConfig.platform.hostname.staging.com,
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

// Helper to check if we're on production domains
export const isProduction = () => {
    if (process.env.APP_ENV === 'production') return true;
    const hostname = window.location.hostname;
    return !!DOMAIN_CONFIG[hostname];
};

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

const getDefaultServerURL = () => {
    const isProductionEnv = isProduction();

    try {
        return isProductionEnv ? WS_SERVERS.PRODUCTION : WS_SERVERS.STAGING;
    } catch (error) {
        console.error('Error in getDefaultServerURL:', error);
    }

    // Production defaults to demov2, staging/preview defaults to qa194 (demo)
    return isProductionEnv ? WS_SERVERS.PRODUCTION : WS_SERVERS.STAGING;
};

/** Returns an account-specific OTP socket for a BFF session, otherwise the public socket. */
export const getSocketURL = async (): Promise<string> => {
    try {
        const session = await DerivWSAccountsService.getSession();
        return session.authenticated
            ? await DerivWSAccountsService.getAuthenticatedWebSocketURL()
            : getDefaultServerURL();
    } catch (error) {
        // An unauthenticated visitor uses only the public market-data socket.
        return getDefaultServerURL();
    }
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);

    return false;
};

export const generateOAuthURL = async (_prompt?: string) => {
    try {
        const returnPath = `${window.location.pathname}${window.location.hash}`;
        return await DerivWSAccountsService.createAuthorizationURL(returnPath || '/');
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
    }

    return ``;
};
