type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    BEST_BOTS: 2,
    DTRADER: 3,
    SCANNER: 4,
    AUTO_TRADES: 5,
    TRADINGVIEW: 6,
    COPY_TRADING: 7,
    CALCULATOR: 8,
    ANALYSIS_TOOL: 9,
    DIGITS_ANALYSIS: 10,
    BOT_IDEAS: 99,
    COMBO: 98,
    CHART: 97,
    TUTORIAL: 96,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-best-bots',
    'id-dtrader',
    'id-scanner',
    'id-auto-trades',
    'id-tradingview',
    'id-copy-trading',
    'id-calculator',
    'id-analysistool',
    'id-digits-analysis',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
