export type StoredBot = {
    id: string;
    name: string;
    description: string;
    xml: string;
    symbol?: string;
    createdAt: number;
    updatedAt: number;
};

const DB_NAME = 'apex-sentinel-bot-store';
const STORE_NAME = 'bots';
const DB_VERSION = 1;

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
        request.onerror = () => reject(request.error ?? new Error('Unable to read bot store.'));
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
        request.onerror = () => reject(request.error ?? new Error('Unable to save bot.'));
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
        request.onerror = () => reject(request.error ?? new Error('Unable to delete bot.'));
        request.onsuccess = () => {
            db.close();
            resolve();
        };
    });
};

export const loadXmlIntoDBot = async (bot: StoredBot): Promise<void> => {
    const workspace = window.Blockly?.derivWorkspace;
    if (!workspace) throw new Error('DBot workspace is not ready yet.');

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
};

export const openDTrader = (symbol?: string): void => {
    const url = symbol
        ? `https://app.deriv.com/dtrader?symbol=${encodeURIComponent(symbol)}`
        : 'https://app.deriv.com/dtrader';
    window.open(url, '_blank', 'noopener,noreferrer');
};
