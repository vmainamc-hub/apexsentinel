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

const BotStore = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [bots, setBots] = React.useState<StoredBot[]>([]);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const refresh = React.useCallback(async () => {
        try {
            setBots(await listStoredBots());
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to read the bot store.');
        }
    }, []);

    React.useEffect(() => {
        if (isOpen) refresh();
    }, [isOpen, refresh]);

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

        // Open synchronously from the user click so popup blockers are less likely to
        // prevent DTrader from opening while the DBot XML is being validated/loaded.
        const dtraderWindow = window.open('about:blank', '_blank');

        try {
            const validation = await loadBot(bot, dtraderWindow);
            setSelectedId(bot.id);
            setMessage(`${bot.name} loaded into DBot${bot.symbol ? ` and DTrader (${bot.symbol})` : ' successfully. DTrader symbol is not configured for this bot.'}`);
            if (!bot.symbol && dtraderWindow && !dtraderWindow.closed) {
                dtraderWindow.close();
            }
            if (validation.warnings.length > 0) {
                setMessage(`${bot.name} loaded into DBot. ${validation.warnings[0]}`);
            }
        } catch (error) {
            if (dtraderWindow && !dtraderWindow.closed) dtraderWindow.close();
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
                                <p>Your personal library of validated DBot XML strategies.</p>
                            </div>
                            <button type='button' className='bot-store__close' onClick={() => setIsOpen(false)} aria-label='Close'>×</button>
                        </header>

                        <div className='bot-store__toolbar'>
                            <button type='button' className='bot-store__primary' onClick={() => fileInputRef.current?.click()}>
                                + Add DBot XML
                            </button>
                            <input ref={fileInputRef} type='file' accept='.xml,application/xml,text/xml' hidden onChange={importBot} />
                            <span>{bots.length} bot{bots.length === 1 ? '' : 's'} stored</span>
                        </div>

                        {message && <div className='bot-store__message' role='status'>{message}</div>}

                        <div className='bot-store__body'>
                            {bots.length === 0 ? (
                                <div className='bot-store__empty'>
                                    <strong>Your Bot Store is empty.</strong>
                                    <p>Click <b>+ Add DBot XML</b> to import an existing DBot strategy. Invalid XML and strategies without a Purchase block are rejected before storage.</p>
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
                            <span><b>Load</b> validates the stored XML, waits for the live DBot Blockly workspace, imports the exact strategy, then opens DTrader for the configured symbol.</span>
                            <span><b>Important:</b> DTrader is a separate interface and does not import DBot XML.</span>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};

export default BotStore;
