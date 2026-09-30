import type { DerivFeature, DerivScope } from '@reef-sites/shared-types';

export interface TemplateDefinition {
    id: string;
    version: string;
    name: string;
    description: string;
    runtimePackage: string;
    supportedTradeTypes: string[];
    supportedPages: string[];
    requiredScopes: DerivScope[];
    optionalFeatures: DerivFeature[];
    releaseStatus: 'draft' | 'approved' | 'deprecated' | 'disabled';
}

export const TEMPLATE_REGISTRY: readonly TemplateDefinition[] = Object.freeze([
    {
        id: 'deriv-bot',
        version: '1.0.0',
        name: 'Deriv Bot',
        description: 'Production Blockly bot and Options trading runtime.',
        runtimePackage: 'trading-bot-template',
        supportedTradeTypes: ['options', 'bots'],
        supportedPages: ['home', 'bot', 'charts', 'portfolio', 'profit_table', 'statement', 'support', 'legal'],
        requiredScopes: ['trade'],
        optionalFeatures: ['public_market_data', 'account_list', 'options_trading', 'markup_statistics'],
        releaseStatus: 'approved',
    },
]);

export function findTemplate(id: string, version?: string): TemplateDefinition | undefined {
    return TEMPLATE_REGISTRY.find(template => template.id === id && (!version || template.version === version));
}

