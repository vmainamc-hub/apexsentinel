export type PlatformRole =
    | 'super_admin'
    | 'operations_admin'
    | 'support_admin'
    | 'finance_viewer'
    | 'tenant_owner'
    | 'tenant_developer'
    | 'tenant_viewer';

export type DerivScope = 'trade' | 'account_manage' | 'payment' | 'application_read';

export type DerivFeature =
    | 'public_market_data'
    | 'account_list'
    | 'options_trading'
    | 'account_creation'
    | 'wallet_balances'
    | 'wallet_transactions'
    | 'markup_statistics'
    | 'application_management';

export interface BrandingConfig {
    brandName: string;
    siteTitle: string;
    logoUrl?: string;
    faviconUrl?: string;
    loaderUrl?: string;
    typography?: string;
    borderRadius?: string;
    buttonStyle?: string;
    headerStyle?: string;
    footerContent?: string;
    poweredByDeriv?: boolean;
    theme: Record<string, string>;
}

export interface DerivPublicConfig {
    appId: string;
    oauthClientId: string;
    gatewayUrl: string;
    requiredScopes: DerivScope[];
    environment: 'staging' | 'production';
}

export interface NavigationItem {
    key: string;
    label: string;
    slug: string;
    enabled: boolean;
    order: number;
    externalUrl?: string;
    placement?: 'header' | 'footer' | 'both';
}

export interface LegalConfig {
    privacyUrl: string;
    termsUrl: string;
    riskDisclaimer: string;
    disclaimerText?: string;
}

export interface SiteRuntimeConfig {
    schemaVersion: number;
    siteId: string;
    tenantId: string;
    domain: string;
    template: { id: string; version: string };
    branding: BrandingConfig;
    deriv: DerivPublicConfig;
    features: Record<string, { enabled: boolean; status: 'ready' | 'experimental' | 'disabled' }>;
    navigation: NavigationItem[];
    legal: LegalConfig;
    deployment: {
        provider: string;
        publicUrl?: string;
        configurationVersion: number;
    };
}

export interface MarkupStatisticRecord {
    id: string;
    tenantId: string;
    siteId?: string;
    derivApplicationId: string;
    startDate: string;
    endDate: string;
    currency?: string;
    markupAmount?: number;
    tradeCount?: number;
    turnover?: number;
    rawSourceVersion: string;
    synchronizedAt: string;
}

export interface ValidationIssue {
    code: string;
    field?: string;
    message: string;
    severity: 'blocking' | 'warning';
}

export interface ConfigurationValidationResult {
    valid: boolean;
    blocking: ValidationIssue[];
    warnings: ValidationIssue[];
    checkedAt: string;
}

