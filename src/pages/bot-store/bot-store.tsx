import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { load } from '@/external/bot-skeleton';
import { localize } from '@deriv-com/translations';
import './bot-store.scss';

export type BotStoreEntry = {
    id: string;
    name: string;
    description?: string;
    category?: string;
    market?: string;
    tags?: string[];
    version?: string;
    author?: string;
    icon?: string;
    xml_url: string;
};

type BotStoreManifest = {
    version: number;
    bots: BotStoreEntry[];
};

// Set this to the raw GitHub URL of the bot-store manifest when your bot
// repository is ready. Keeping the source in one place means the store UI
// never needs to know the repository layout.
export const BOT_STORE_MANIFEST_URL = '';

const BotStore = observer(() => {
    const { dashboard } = useStore();
    const [manifest, setManifest] = useState<BotStoreManifest | null>(null);
    const [is_loading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('All');
    const [loading_bot_id, setLoadingBotId] = useState('');

    const fetchManifest = async () => {
        if (!BOT_STORE_MANIFEST_URL) {
            setManifest({ version: 1, bots: [] });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(BOT_STORE_MANIFEST_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Bot Store manifest returned ${response.status}`);
            const data = (await response.json()) as BotStoreManifest;
            if (!data || !Array.isArray(data.bots)) throw new Error('Invalid Bot Store manifest');
            setManifest(data);
        } catch (fetch_error) {
            console.error('[BotStore] Failed to load manifest:', fetch_error);
            setError(localize('The Bot Store could not load its bot catalogue.'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchManifest();
    }, []);

    const categories = useMemo(() => {
        const values = new Set((manifest?.bots ?? []).map(bot => bot.category).filter(Boolean) as string[]);
        return ['All', ...Array.from(values).sort()];
    }, [manifest]);

    const filtered_bots = useMemo(() => {
        const normalized_query = query.trim().toLowerCase();
        return (manifest?.bots ?? []).filter(bot => {
            const matches_category = category === 'All' || bot.category === category;
            if (!matches_category) return false;
            if (!normalized_query) return true;
            return [bot.name, bot.description, bot.category, bot.market, bot.author, ...(bot.tags ?? [])]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(normalized_query);
        });
    }, [category, manifest, query]);

    const loadBot = async (bot: BotStoreEntry) => {
        if (!window.Blockly?.derivWorkspace) {
            setError(localize('Bot Builder is not ready yet. Please try again in a moment.'));
            return;
        }

        setLoadingBotId(bot.id);
        setError('');
        try {
            const response = await fetch(bot.xml_url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Bot XML returned ${response.status}`);
            const xml = await response.text();
            const result = await load({
                block_string: xml,
                file_name: `${bot.name}.xml`,
                strategy_id: bot.id,
                from: 'bot_store',
                drop_event: null,
                workspace: window.Blockly.derivWorkspace,
                showIncompatibleStrategyDialog: null,
                show_snackbar: true,
            });

            if (result?.error) {
                throw new Error(result.error);
            }

            dashboard.setActiveTab(1);
            window.location.hash = 'bot_builder';
        } catch (load_error) {
            console.error(`[BotStore] Failed to load ${bot.id}:`, load_error);
            setError(localize('This bot could not be loaded into Bot Builder.'));
        } finally {
            setLoadingBotId('');
        }
    };

    return (
        <section className='bot-store' aria-label={localize('Bot Store')}>
            <header className='bot-store__header'>
                <div>
                    <span className='bot-store__eyebrow'>{localize('SENTINEL BOT STORE')}</span>
                    <h1>{localize('Trading Bots')}</h1>
                    <p>{localize('Browse your verified bots and load any bot directly into Bot Builder.')}</p>
                </div>
                <div className='bot-store__count'>
                    <strong>{manifest?.bots.length ?? 0}</strong>
                    <span>{localize('bots')}</span>
                </div>
            </header>

            <div className='bot-store__toolbar'>
                <input
                    aria-label={localize('Search bots')}
                    className='bot-store__search'
                    onChange={event => setQuery(event.target.value)}
                    placeholder={localize('Search bots, markets, strategies...')}
                    value={query}
                />
                <div className='bot-store__categories' role='group' aria-label={localize('Bot categories')}>
                    {categories.map(item => (
                        <button
                            className={item === category ? 'is-active' : ''}
                            key={item}
                            onClick={() => setCategory(item)}
                            type='button'
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className='bot-store__error' role='alert'>
                    <span>{error}</span>
                    <button onClick={fetchManifest} type='button'>
                        {localize('Retry')}
                    </button>
                </div>
            )}

            {is_loading ? (
                <div className='bot-store__state'>{localize('Loading Bot Store...')}</div>
            ) : filtered_bots.length === 0 ? (
                <div className='bot-store__empty'>
                    <div className='bot-store__empty-icon'>🤖</div>
                    <h2>{BOT_STORE_MANIFEST_URL ? localize('No bots found') : localize('Your Bot Store is ready')}</h2>
                    <p>
                        {BOT_STORE_MANIFEST_URL
                            ? localize('Try another search or category.')
                            : localize('Connect your GitHub bot catalogue to start populating the store.')}
                    </p>
                </div>
            ) : (
                <div className='bot-store__grid'>
                    {filtered_bots.map(bot => (
                        <article className='bot-card' key={bot.id}>
                            <div className='bot-card__topline'>
                                <div className='bot-card__icon'>{bot.icon || '🤖'}</div>
                                {bot.category && <span className='bot-card__category'>{bot.category}</span>}
                            </div>
                            <h2>{bot.name}</h2>
                            <p>{bot.description || localize('Verified bot strategy ready for Bot Builder.')}</p>
                            <div className='bot-card__meta'>
                                {bot.market && <span>{bot.market}</span>}
                                {bot.version && <span>v{bot.version}</span>}
                                {bot.author && <span>{bot.author}</span>}
                            </div>
                            <div className='bot-card__tags'>
                                {(bot.tags ?? []).slice(0, 4).map(tag => (
                                    <span key={tag}>{tag}</span>
                                ))}
                            </div>
                            <button
                                className='bot-card__load'
                                disabled={loading_bot_id === bot.id}
                                onClick={() => loadBot(bot)}
                                type='button'
                            >
                                {loading_bot_id === bot.id ? localize('Loading...') : localize('Load into Bot Builder')}
                            </button>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
});

export default BotStore;
