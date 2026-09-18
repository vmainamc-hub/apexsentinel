import React from 'react';
import {
    deleteStoredBot,
    listStoredBots,
    loadBot,
    openDTrader,
    saveStoredBot,
    validateBotXml,
    type StoredBot,
} from '@/services/bot-store.service';
import './bot-store.scss';

const BOT_STORE_CATALOGUE_URL =
    'https://raw.githubusercontent.com/vmainamc-hub/sentinel-bot-store/main/catalogue.json';

type RemoteBot = {
    id: string;
    name: string;
    description?: string;
    market?: string;
    version?: string;
    author?: string;
    tags?: string[];
    xml_url: string;
};

type RemoteCatalogue = {
    version: number;
    bots: RemoteBot[];
};

const BotStore = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [bots, setBots] = React.useState<StoredBot[]>([]);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState('');
    const [isSyncing, setIsSyncing] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const refresh = React.useCallback(async () => {
        try {
            setBots(await listStoredBots());
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to read the bot store.');
        }
    }, []);

    const syncRemoteCatalogue = React.useCallback(async () => {
        setIsSyncing(true);
        try {
            const response = await fetch(BOT_STORE_CATALOGUE_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Bot catalogue returned ${response.status}`);
            const catalogue = (await response.json()) as RemoteCatalogue;
            if (!catalogue || !Array.isArray(catalogue.bots)) throw new Error('Invalid Bot Store catalogue.');

            const now = Date.now();
            const results = await Promise.all(
                catalogue.bots.map(async remoteBot => {
                    const xmlResponse = await fetch(remoteBot.xml_url, { cache: 'no-store' });
                    if (!xmlResponse.ok) throw new Error(`${remoteBot.name}: XML returned ${xmlResponse.status}`);
                    const xml = await xmlResponse.text();
                    const validation = validateBotXml(xml);
                    if (!validation.valid) {
                        throw new Error(`${remoteBot.name}: ${validation.errors[0]}`);
                    }

                    await saveStoredBot({
                        id: remoteBot.id,
                        name: remoteBot.name,
                        description: remoteBot.description || 'Verified DBot strategy from the Sentinel Bot Store catalogue.',
                        xml,
                        symbol: remoteBot.market,
                        version: remoteBot.version || 'DBot XML',
                        author: remoteBot.author || 'Sentinel Bot Store',
                        tags: remoteBot.tags,
                        createdAt: now,
                        updatedAt: now,
                        validation,
                    });
                    return remoteBot.name;
                })
            );

            await refresh();
            setMessage(`${results.length} catalogue bot${results.length === 1 ? '' : 's'} synchronized and validated.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to synchronize the Bot Store catalogue.');
        } finally {
            setIsSyncing(false);
        }
    }, [refresh]);

    React.useEffect(() => {
        if (isOpen) {
            void refresh();
            void syncRemoteCatalogue();
        }
    }, [isOpen, refresh, syncRemoteCatalogue]);

    const importBot = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.xml')) {
            setMessage('Please select a DBot XML file.');
            return;
        }

        try {
            const xml = await file.text();
            const validation = validateBotXml(xml);
            if (!validation.valid) {
                throw new Error(`Rejected ${file.name}: ${validation.errors[0]}`);
            }

            const parsed = typeof DOMParser !== 'undefined'
                ? new DOMParser().parseFromString(xml, 'application/xml')
                : null;
            const symbol = parsed
                ? Array.from(parsed.querySelectorAll('*')).map(node =>
                      ['symbol', 'underlying', 'market']
                          .map(attribute => node.getAttribute(attribute)?.trim())
                          .find(value => value && /^[A-Za-z0-9_./-]{2,32}$/.test(value))
                  ).find(Boolean)
                : undefined;

            const name = file.name.replace(/\.xml$/i, '').trim() || 'Untitled Bot';
            const now = Date.now();
            await saveStoredBot({
                id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${now}`,
                name,
                description: 'Imported DBot strategy',
                xml,
                symbol,
                version: 'DBot XML',
                createdAt: now,
                updatedAt: now,
                validation,
            });
            await refresh();
            setMessage(`${name} added. ${validation.blockCount} blocks and ${validation.purchaseBlockCount} Purchase block${validation.purchaseBlockCount === 1 ? '' : 's'} validated.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to import this bot.');
        }
    };

    const loadBotFromStore = async (bot: StoredBot) => {
        setBusyId(bot.id);
        setMessage('');

        try {
            const validation = await loadBot(bot);
            setSelectedId(bot.id);
            setMessage(`${bot.name} loaded into DBot${bot.symbol ? ` and DTrader (${bot.symbol})` : ' successfully. DTrader symbol is not configured for this bot.'}`);
            if (validation.warnings.length > 0) {
                setMessage(`${bot.name} loaded into DBot. ${validation.warnings[0]}`);
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load this bot into DBot.');
        } finally {
            setBusyId(null);
        }
    };

    const removeBot = async (bot: StoredBot) => {
        if (!window.confirm(`Remove "${bot.name}" from your Bot Store?`)) return;
        try {
            await deleteStoredBot(bot.id);
            if (selectedId === bot.id) setSelectedId(null);
            await refresh();
            setMessage(`${bot.name} removed from your Bot Store.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to remove this bot.');
        }
    };

    return (
        <>
            <button className='bot-store-trigger' onClick={() => setIsOpen(true)} type='button'>
                <span className='bot-store-trigger__icon'>▣</span>
                Bot Store
            </button>

            {isOpen && (
                <div className='bot-store-overlay' role='presentation' onMouseDown={e => e.target === e.currentTarget && setIsOpen(false)}>
                    <section className='bot-store' role='dialog' aria-modal='true' aria-labelledby='bot-store-title'>
                        <header className='bot-store__header'>
                            <div>
                                <div className='bot-store__eyebrow'>APEX SENTINEL</div>
                                <h2 id='bot-store-title'>Bot Store</h2>
                                <p>Verified DBot strategies from the Sentinel catalogue.</p>
                            </div>
                            <button type='button' className='bot-store__close' onClick={() => setIsOpen(false)} aria-label='Close'>×</button>
                        </header>

                        <div className='bot-store__toolbar'>
                            <button type='button' className='bot-store__primary' onClick={() => fileInputRef.current?.click()}>
                                + Add DBot XML
                            </button>
                            <input ref={fileInputRef} type='file' accept='.xml,application/xml,text/xml' hidden onChange={importBot} />
                            <button type='button' className='bot-store__sync' disabled={isSyncing} onClick={() => void syncRemoteCatalogue()}>
                                {isSyncing ? 'Syncing…' : '↻ Sync Catalogue'}
                            </button>
                            <span>{bots.length} bot{bots.length === 1 ? '' : 's'} stored</span>
                        </div>

                        {message && <div className='bot-store__message' role='status'>{message}</div>}

                        <div className='bot-store__body'>
                            {bots.length === 0 ? (
                                <div className='bot-store__empty'>
                                    <strong>{isSyncing ? 'Loading Bot Store…' : 'Your Bot Store is empty.'}</strong>
                                    <p>{isSyncing ? 'Synchronizing the GitHub catalogue and validating each DBot XML.' : 'Add a DBot XML or synchronize the Sentinel catalogue.'}</p>
                                </div>
                            ) : (
                                bots.map(bot => (
                                    <article className={`bot-card ${selectedId === bot.id ? 'bot-card--selected' : ''}`} key={bot.id}>
                                        <div className='bot-card__main'>
                                            <h3>{bot.name}</h3>
                                            <p>{bot.description}</p>
                                            <div className='bot-card__meta'>
                                                <span className='bot-card__status'>✓ DBot XML validated</span>
                                                {bot.symbol && <span className='bot-card__symbol'>{bot.symbol}</span>}
                                                {bot.validation && <span>{bot.validation.blockCount} blocks</span>}
                                            </div>
                                        </div>
                                        <div className='bot-card__actions'>
                                            <button type='button' className='bot-card__load' disabled={busyId === bot.id} onClick={() => loadBotFromStore(bot)}>
                                                {busyId === bot.id ? 'Loading…' : 'Load'}
                                            </button>
                                            <button type='button' onClick={() => openDTrader(bot.symbol)}>DTrader</button>
                                            <button type='button' className='bot-card__delete' onClick={() => removeBot(bot)}>Remove</button>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>

                        <footer className='bot-store__footer'>
                            <span><b>Load</b> validates the stored XML, imports the exact strategy into the live DBot Blockly workspace, then opens DTrader for the configured market.</span>
                            <span><b>Source:</b> the public Sentinel bot catalogue in GitHub. The XML files themselves are kept unchanged.</span>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};

export default BotStore;
