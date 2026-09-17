export type BotValidation = {
    valid: boolean;
    errors: string[];
    warnings: string[];
    blockCount: number;
    purchaseBlockCount: number;
};

export type StoredBot = {
    id: string;
    name: string;
    description: string;
    xml: string;
    symbol?: string;
    version?: string;
    author?: string;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
    validation?: BotValidation;
};

const DB_NAME = 'apex-sentinel-bot-store';
const STORE_NAME = 'bots';
const DB_VERSION = 2;

const openDatabase = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not available in this browser.'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error ?? new Error('Unable to open bot store.'));
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
    });

export const listStoredBots = async (): Promise<StoredBot[]> => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        request.onerror = () => {
            db.close();
            reject(request.error ?? new Error('Unable to read bot store.'));
        };
        request.onsuccess = () => {
            db.close();
            resolve((request.result as StoredBot[]).sort((a, b) => b.updatedAt - a.updatedAt));
        };
    });
};

export const saveStoredBot = async (bot: StoredBot): Promise<void> => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(bot);
        request.onerror = () => {
            db.close();
            reject(request.error ?? new Error('Unable to save bot.'));
        };
        request.onsuccess = () => {
            db.close();
            resolve();
        };
    });
};

export const deleteStoredBot = async (id: string): Promise<void> => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
        request.onerror = () => {
            db.close();
            reject(request.error ?? new Error('Unable to delete bot.'));
        };
        request.onsuccess = () => {
            db.close();
            resolve();
        };
    });
};

const extractSymbol = (doc: Document): string | undefined => {
    const candidates = ['symbol', 'underlying', 'market'];
    const nodes = Array.from(doc.querySelectorAll('*'));
    for (const node of nodes) {
        for (const attribute of candidates) {
            const value = node.getAttribute(attribute)?.trim();
            if (value && /^[A-Za-z0-9_./-]{2,32}$/.test(value)) return value;
        }
    }
    return undefined;
};

export const validateBotXml = (xml: string): BotValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let blockCount = 0;
    let purchaseBlockCount = 0;

    if (!xml.trim()) {
        return { valid: false, errors: ['The XML file is empty.'], warnings, blockCount, purchaseBlockCount };
    }

    if (/\bns\d+:/.test(xml)) {
        errors.push('The XML contains namespace-prefixed tags (for example ns0:), which are not accepted by the DBot loader.');
    }

    if (typeof DOMParser === 'undefined') {
        warnings.push('XML parser is unavailable in this environment; structural validation will run when the bot is loaded.');
        return { valid: errors.length === 0, errors, warnings, blockCount, purchaseBlockCount };
    }

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) {
        errors.push('The XML is malformed and cannot be parsed safely.');
        return { valid: false, errors, warnings, blockCount, purchaseBlockCount };
    }

    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'xml') {
        errors.push('The DBot file must have an <xml> root element.');
    }

    const blocks = Array.from(doc.querySelectorAll('block'));
    blockCount = blocks.length;
    if (blockCount === 0) errors.push('No Blockly blocks were found in this strategy.');

    purchaseBlockCount = blocks.filter(block => {
        const type = block.getAttribute('type')?.toLowerCase() ?? '';
        return /purchase/.test(type);
    }).length;

    if (purchaseBlockCount === 0) {
        errors.push('The strategy does not contain a Purchase block. DBot strategies require a Purchase block.');
    }

    const text = xml.toLowerCase();
    if (!text.includes('strategy')) warnings.push('No strategy metadata was detected; the bot may still load if its Blockly structure is valid.');

    return { valid: errors.length === 0, errors, warnings, blockCount, purchaseBlockCount };
};

const waitForDBotWorkspace = async (timeoutMs = 15000): Promise<NonNullable<typeof window.Blockly.derivWorkspace>> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const workspace = window.Blockly?.derivWorkspace;
        if (workspace) return workspace;
        await new Promise(resolve => window.setTimeout(resolve, 250));
    }
    throw new Error('DBot workspace is not ready yet. Open DBot and wait for the Blockly workspace to finish loading, then try again.');
};

export const loadXmlIntoDBot = async (bot: StoredBot): Promise<BotValidation> => {
    const validation = validateBotXml(bot.xml);
    if (!validation.valid) {
        throw new Error(`Cannot load "${bot.name}": ${validation.errors[0]}`);
    }

    const workspace = await waitForDBotWorkspace();
    const { load, save_types } = await import('@/external/bot-skeleton');
    await load({
        block_string: bot.xml,
        strategy_id: bot.id,
        file_name: bot.name,
        workspace,
        from: save_types.LOCAL,
        drop_event: {},
        showIncompatibleStrategyDialog: false,
        show_snackbar: true,
    });

    workspace.strategy_to_load = bot.xml;
    return validation;
};

export const openDTrader = (symbol?: string, target?: Window | null): void => {
    const url = symbol
        ? `https://app.deriv.com/dtrader?symbol=${encodeURIComponent(symbol)}`
        : 'https://app.deriv.com/dtrader';
    if (target && !target.closed) {
        target.location.href = url;
        target.focus();
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};

export const loadBot = async (bot: StoredBot, dtraderWindow?: Window | null): Promise<BotValidation> => {
    const validation = await loadXmlIntoDBot(bot);
    openDTrader(bot.symbol, dtraderWindow);
    return validation;
};
