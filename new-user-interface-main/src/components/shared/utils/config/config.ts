import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { APP_CONFIG } from '@/config/app-config';
import brandConfig from '../../../../../brand.config.json';

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
    botsFolder: string;
    features: DomainFeatureFlags;
    ui: DomainUIConfig;
}

const DEFAULT_DOMAIN_FEATURES: DomainFeatureFlags = {
    botIdeas: false,
    scanner: true,
    printPopups: true,
    autoTrades: true,
    comboTrades: false,
    chart: true,
    tutorials: true,
};

const DEFAULT_DOMAIN_UI: DomainUIConfig = {
    brandName: APP_CONFIG.brandName,
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
    customCssVars: {
        '--rm-shell-top': '#1a1a2e',
        '--rm-shell-top-light': '#1a1a2e',
        '--rm-shell-nav': '#111827',
        '--rm-shell-nav-active': '#2d2d44',
        '--rm-shell-nav-hover': '#24243a',
        '--rm-shell-gold': '#f97316',
        '--rm-shell-text': '#ffffff',
        '--rm-shell-header-text': '#ffffff',
        '--rm-shell-nav-text': '#e0e0e0',
        '--rm-shell-panel-text': '#ffffff',
        '--rm-shell-panel-text-muted': '#a0a0b0',
        '--rm-shell-surface': '#1a1a2e',
        '--rm-shell-surface-2': '#1e1e32',
        '--rm-shell-border': '#2d2d44',
        '--rm-shell-input-bg': '#1e1e32',
        '--rm-shell-input-text': '#ffffff',
        '--rm-shell-button-text': '#ffffff',
        '--rm-shell-circle-bg': '#2d2d44',
        '--rm-shell-circle-text': '#e0e0e0',
        '--rm-shell-muted': '#a0a0b0',
        '--rm-shell-auth-blue': '#1a1a2e',
        '--rm-shell-auth-border': '#2d2d44',
        '--rm-shell-run': '#f97316',
        '--rm-shell-run-hover': '#2196f3',
        '--rm-shell-run-panel': '#050a14',
        '--rm-shell-run-panel-light': '#1e1e32',
        '--rm-shell-section': '#1e1e32',
        '--rm-shell-section-2': '#16213e',
        '--rm-shell-section-muted': '#2d2d44',
        '--rm-shell-section-border': '#2d2d44',
        '--rm-shell-run-panel-border': '#2d2d44',
        '--rm-shell-run-panel-border-soft': 'rgba(45,45,68,.55)',
    },
};

const STANDALONE_CONFIG: DomainConfig = {
    botsFolder: APP_CONFIG.botsFolder,
    features: DEFAULT_DOMAIN_FEATURES,
    ui: DEFAULT_DOMAIN_UI,
};

// Apex Sentinel is a single-site product: there is no per-hostname tenant table.
// The public origin is configured once, server-side, via APEX_SITE_URL.
export const getDomainConfig = (): DomainConfig => STANDALONE_CONFIG;

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
    Object.entries(ui.customCssVars).forEach(([key, value]) => root.style.setProperty(key, value));
    document.title = ui.brandName;
};

export const buildBestBotsFileUrl = (bots_folder: string, file_name: string) =>
    `/${encodeURI(bots_folder)}/${encodeURIComponent(file_name)}`;
export const getBestBotsFileUrl = (file_name: string) => buildBestBotsFileUrl(getBestBotsFolder(), file_name);

export const WS_SERVERS = {
    STAGING: `${brandConfig.platform.derivws.url.staging}options/ws/public`,
    PRODUCTION: `${brandConfig.platform.derivws.url.production}options/ws/public`,
} as const;

export const PRODUCTION_DOMAINS = {
    COM: brandConfig.platform.hostname.production.com,
} as const;

export const STAGING_DOMAINS = {
    COM: brandConfig.platform.hostname.staging.com,
} as const;

export const isProduction = () => {
    if (typeof window === 'undefined') return true;
    return !/localhost(:\\d+)?$/i.test(window.location.hostname);
};

export const isLocal = () =>
    typeof window !== 'undefined' && /localhost(:\\d+)?$/i.test(window.location.hostname);

const getDefaultServerURL = () => WS_SERVERS.PRODUCTION;

export const getSocketURL = async (): Promise<string> => {
    try {
        const session = await DerivWSAccountsService.getSession();
        return session.authenticated
            ? await DerivWSAccountsService.getAuthenticatedWebSocketURL()
            : getDefaultServerURL();
    } catch {
        return getDefaultServerURL();
    }
};

export const getDebugServiceWorker = () => {
    if (typeof window === 'undefined') return false;
    const value = window.localStorage.getItem('debug_service_worker');
    return value ? !!parseInt(value, 10) : false;
};

export const generateOAuthURL = async (_prompt?: string) => {
    try {
        const returnPath = typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.hash}`;
        return await DerivWSAccountsService.createAuthorizationURL(returnPath || '/');
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
        return '';
    }
};
