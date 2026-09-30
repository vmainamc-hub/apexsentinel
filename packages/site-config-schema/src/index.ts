export type RuntimeSiteConfig = {
    schemaVersion: number;
    version?: number;
    generatedAt?: string;
    tenantId: string;
    template: {
        id: string;
        version: string;
    };
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
        requiredScopes?: Array<'trade' | 'account_manage' | 'payment' | 'application_read'>;
        environment?: 'staging' | 'production';
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
    navigation?: Array<{
        key: string;
        label: string;
        slug: string;
        enabled: boolean;
        order: number;
        externalUrl?: string;
        placement?: 'header' | 'footer' | 'both';
    }>;
    legal?: {
        privacyUrl?: string;
        termsUrl?: string;
        riskDisclaimer?: string;
        disclaimerText?: string;
    };
    tools?: Array<{
        key: string;
        name: string;
        enabled: boolean;
        version: string;
        displayOrder: number;
        settings?: Record<string, unknown>;
    }>;
};
