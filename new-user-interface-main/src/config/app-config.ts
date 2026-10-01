export type DerivScope = 'trade' | 'account_manage' | 'payment' | 'application_read';

export const APP_CONFIG = {
    brandName: 'Apex Sentinel',
    gatewayUrl: '/api',
    requiredScopes: ['trade'] as DerivScope[],
    botsFolder: 'apex-sentinel',
} as const;
