import React from 'react';
import {
    deleteStoredBot,
    listStoredBots,
    loadXmlIntoDBot,
    openDTrader,
    saveStoredBot,
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
            if (!xml.trim()) throw new Error('The XML file is empty.');

            const name = file.name.replace(/\.xml$/i, '').trim() || 'Untitled Bot';
            const now = Date.now();
            await saveStoredBot({
                id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${now}`,
                name,
                description: 'Imported DBot strategy',
                xml,
                createdAt: now,
                updatedAt: now,
            });
            await refresh();
            setMessage(`${name} added to your Bot Store.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to import this bot.');
        }
    };

    const loadBot = async (bot: StoredBot) => {
        setBusyId(bot.id);
        setMessage('');
        try {
            await loadXmlIntoDBot(bot);
            setSelectedId(bot.id);
            setMessage(`${bot.name} loaded into DBot.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load this bot into DBot.');
        } finally {
            setBusyId(null);
        }
    };

    const removeBot = async (bot: StoredBot) => {
        if (!window.confirm(`Remove "${bot.name}" from your Bot Store?`)) return;
        await deleteStoredBot(bot.id);
        if (selectedId === bot.id) setSelectedId(null);
        await refresh();
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
                                <p>Your personal library of DBot XML strategies.</p>
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

                        {message && <div className='bot-store__message'>{message}</div>}

                        <div className='bot-store__body'>
                            {bots.length === 0 ? (
                                <div className='bot-store__empty'>
                                    <strong>Your Bot Store is empty.</strong>
                                    <p>Click <b>+ Add DBot XML</b> to put your existing bots here. They remain available in this browser.</p>
                                </div>
                            ) : (
                                bots.map(bot => (
                                    <article className={`bot-card ${selectedId === bot.id ? 'bot-card--selected' : ''}`} key={bot.id}>
                                        <div className='bot-card__main'>
                                            <h3>{bot.name}</h3>
                                            <p>{bot.description}</p>
                                            {bot.symbol && <span className='bot-card__symbol'>{bot.symbol}</span>}
                                        </div>
                                        <div className='bot-card__actions'>
                                            <button type='button' className='bot-card__load' disabled={busyId === bot.id} onClick={() => loadBot(bot)}>
                                                {busyId === bot.id ? 'Loading…' : 'Load to DBot'}
                                            </button>
                                            <button type='button' onClick={() => openDTrader(bot.symbol)}>Open DTrader</button>
                                            <button type='button' className='bot-card__delete' onClick={() => removeBot(bot)}>Remove</button>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>

                        <footer className='bot-store__footer'>
                            <span><b>Load to DBot</b> imports the exact XML into the live Blockly workspace.</span>
                            <span><b>Open DTrader</b> opens the matching Deriv trading interface; DTrader does not accept DBot XML.</span>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};

export default BotStore;
