import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getBestBotsFileUrl, getBestBotsFolder } from '@/components/shared';
import { DBOT_TABS } from '@/constants/bot-contents';
import { load, save_types } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { setActiveBot } from '@/utils/bot-tracker';
import './best-bots.scss';

type TBot = {
    id: string;
    name: string;
    file: string;
    description: string;
    emoji: string;
};

type TBotStats = {
    bot_id: string;
    total_runs: number;
    profits: number;
    losses: number;
    profit_amount?: number | string | null;
    loss_amount?: number | string | null;
};

const MIN_RUNS_FOR_RATING = 3;
const DEVELOPER_DISPLAY_NAME = 'Mr Duke';

const formatMoney = (value: number | string | null | undefined) => {
    const n = Number(value || 0);
    const sign = n < 0 ? '-' : '';
    return `${sign}$${Math.abs(n).toFixed(2)}`;
};

const computeStars = (profits: number, losses: number) => {
    const total = (profits || 0) + (losses || 0);
    if (total < MIN_RUNS_FOR_RATING) return 0;
    const rate = profits / total;
    if (rate >= 0.8) return 5;
    if (rate >= 0.6) return 4;
    if (rate >= 0.4) return 3;
    if (rate >= 0.2) return 2;
    return 1;
};

const StarRating = ({ profits, losses }: { profits: number; losses: number }) => {
    const stars = computeStars(profits, losses);
    if (stars === 0) {
        return <span className='bb-card__rating bb-card__rating--new'>New – not enough runs</span>;
    }
    return (
        <span className='bb-card__rating' title={`${stars} out of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
                <span
                    key={i}
                    className={`bb-card__star${i < stars ? ' bb-card__star--filled' : ''}`}
                    aria-hidden='true'
                >
                    ★
                </span>
            ))}
            <span className='bb-card__rating-value'>{stars}/5</span>
        </span>
    );
};

const APEX_SENTINEL_BOTS: TBot[] = [
    {
        id: 'grffy',
        name: 'grffy v1',
        file: 'grffy v1.xml',
        description: 'Grffy trading strategy from the RiskManagers-style free bot library.',
        emoji: '🤖',
    },
    {
        id: 'mrduke-speed',
        name: 'Mr Duke Speed Bot.1',
        file: 'Mr Duke Speed Bot.1.xml',
        description: 'Speed-focused trading bot from the RiskManagers-style library.',
        emoji: '⚡',
    },
    {
        id: 'wealth-generator',
        name: 'Wealth Generator',
        file: 'Wealth Generator.xml',
        description: 'Automated strategy from the RiskManagers-style free bot library.',
        emoji: '💰',
    },
];

const BOTS_BY_FOLDER: Record<string, TBot[]> = {
    'apex-sentinel': APEX_SENTINEL_BOTS,
};

export const getBestBotsForFolder = (bots_folder: string) => BOTS_BY_FOLDER[bots_folder] ?? [];

const BotCard = observer(({ bot, stats }: { bot: TBot; stats: TBotStats | undefined }) => {
    const { dashboard, toolbar } = useStore();
    const { setActiveTab } = dashboard;
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const handleLoad = async () => {
        setLoading(true);
        setError(false);
        try {
            const url = getBestBotsFileUrl(bot.file);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const xml_text = await res.text();
            const workspace = window.Blockly?.derivWorkspace;
            if (!workspace) throw new Error('Workspace not ready');
            await load({
                block_string: xml_text,
                file_name: bot.name,
                workspace,
                from: save_types.LOCAL,
                drop_event: {},
                strategy_id: null,
                showIncompatibleStrategyDialog: false,
            });
            setActiveBot('best-bot', bot.id, bot.name);
            try {
                toolbar.setStrategyProtected(true);
            } catch {
                // Keep loading the bot even if toolbar protection is unavailable.
            }
            setTimeout(() => {
                const ws = window.Blockly?.derivWorkspace;
                if (ws) {
                    ws.getAllBlocks(false).forEach((block: any) => {
                        if (['before_purchase', 'after_purchase', 'purchase', 'trade_again'].includes(block.type)) {
                            block.setCollapsed(true);
                        }
                    });
                }
            }, 500);
            setLoaded(true);
            setTimeout(() => setLoaded(false), 3000);
            setActiveTab(DBOT_TABS.BOT_BUILDER);
        } catch {
            setError(true);
            setTimeout(() => setError(false), 4000);
        } finally {
            setLoading(false);
        }
    };

    const totalRuns = stats?.total_runs ?? 0;
    const profits = stats?.profits ?? 0;
    const losses = stats?.losses ?? 0;
    const profitAmount = stats?.profit_amount ?? 0;
    const lossAmount = stats?.loss_amount ?? 0;

    return (
        <div className='bb-card'>
            <span className='bb-card__emoji'>{bot.emoji}</span>
            <h3 className='bb-card__name'>{bot.name}</h3>
            <p className='bb-card__developer'>
                Developed by <strong>{DEVELOPER_DISPLAY_NAME}</strong>
            </p>
            <p className='bb-card__desc'>{bot.description}</p>

            <div className='bb-card__stats'>
                <span className='bb-card__stat bb-card__stat--runs'>🔄 {totalRuns} Runs</span>
                <span className='bb-card__stat bb-card__stat--profit'>
                    ✅ {profits} Wins · +{formatMoney(profitAmount)}
                </span>
                <span className='bb-card__stat bb-card__stat--loss'>
                    ❌ {losses} Losses · -{formatMoney(lossAmount)}
                </span>
            </div>
            <StarRating profits={profits} losses={losses} />

            <button
                className={`bb-card__btn${loaded ? ' bb-card__btn--loaded' : ''}${error ? ' bb-card__btn--error' : ''}`}
                onClick={handleLoad}
                disabled={loading}
            >
                {loading ? 'Loading…' : loaded ? '✓ Loaded to Builder' : error ? '✗ Failed — retry' : 'Load Bot'}
            </button>
        </div>
    );
});

const API_BASE = '/api';

const BestBots = () => {
    const [statsMap, setStatsMap] = useState<Record<string, TBotStats>>({});
    const bots = getBestBotsForFolder(getBestBotsFolder());

    useEffect(() => {
        const loadStats = () => {
            fetch(`${API_BASE}/best-bot-stats`)
                .then(r => r.json())
                .then((rows: TBotStats[]) => {
                    const map: Record<string, TBotStats> = {};
                    rows.forEach(r => {
                        map[r.bot_id] = r;
                    });
                    setStatsMap(map);
                })
                .catch(() => {});
        };
        loadStats();
        const interval = setInterval(loadStats, 30_000);
        return () => clearInterval(interval);
    }, []);

    const rankedBots = [...bots].sort((a, b) => {
        const sa = statsMap[a.id];
        const sb = statsMap[b.id];
        const netA = Number(sa?.profit_amount || 0) - Number(sa?.loss_amount || 0);
        const netB = Number(sb?.profit_amount || 0) - Number(sb?.loss_amount || 0);
        if (netB !== netA) return netB - netA;
        const pa = sa?.profits ?? 0;
        const pb = sb?.profits ?? 0;
        if (pb !== pa) return pb - pa;
        const la = sa?.losses ?? 0;
        const lb = sb?.losses ?? 0;
        return la - lb;
    });

    return (
        <div className='best-bots'>
            <div className='best-bots__grid'>
                {rankedBots.length > 0 ? (
                    rankedBots.map(bot => <BotCard key={bot.id} bot={bot} stats={statsMap[bot.id]} />)
                ) : (
                    <p>No bots configured for this domain yet.</p>
                )}
            </div>
        </div>
    );
};

export default BestBots;
