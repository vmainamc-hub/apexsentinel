import { SCOPE_REGISTRY } from '@reef-sites/deriv-auth';
import type { DerivFeature } from '@reef-sites/shared-types';

export type FeatureReleaseStatus = 'ready' | 'experimental' | 'deprecated' | 'disabled';

export interface FeatureDefinition {
    key: DerivFeature;
    name: string;
    description: string;
    requiredCapabilities: string[];
    supportedApi: string;
    releaseStatus: FeatureReleaseStatus;
}

const definitions: FeatureDefinition[] = [
    ['public_market_data', 'Public market data', 'Live public prices and symbols.', ['public_websocket'], 'Options public WebSocket', 'ready'],
    ['account_list', 'Options accounts', 'Demo and real Options account selection.', ['trader_bff'], 'GET /trading/v1/options/accounts', 'ready'],
    ['options_trading', 'Options trading', 'Proposals, purchases, and contract monitoring.', ['trader_bff', 'authenticated_websocket'], 'Options OTP WebSocket', 'ready'],
    ['account_creation', 'Account creation', 'Create eligible Options accounts.', ['trader_bff'], 'POST /trading/v1/options/accounts', 'experimental'],
    ['wallet_balances', 'Wallet balances', 'Wallet balance views.', ['trader_bff'], 'Wallet API', 'experimental'],
    ['wallet_transactions', 'Wallet transactions', 'Wallet transaction views.', ['trader_bff'], 'Wallet API', 'experimental'],
    ['markup_statistics', 'Markup statistics', 'Registered-application markup reporting.', ['owner_bff'], 'GET /applications/v1/markup-statistics', 'ready'],
    ['application_management', 'Application management', 'Registered application metadata.', ['owner_bff'], 'Applications API', 'experimental'],
].map(([key, name, description, requiredCapabilities, supportedApi, releaseStatus]) => ({
    key: key as DerivFeature,
    name: name as string,
    description: description as string,
    requiredCapabilities: requiredCapabilities as string[],
    supportedApi: supportedApi as string,
    releaseStatus: releaseStatus as FeatureReleaseStatus,
}));

export const FEATURE_REGISTRY = Object.freeze(
    Object.fromEntries(definitions.map(definition => [definition.key, { ...definition, ...SCOPE_REGISTRY[definition.key] }]))
);
