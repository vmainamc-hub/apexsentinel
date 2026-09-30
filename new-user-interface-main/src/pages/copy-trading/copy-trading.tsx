import { useCallback, useEffect, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import '../riskmanagers-tools.scss';

type Trader = { id?: string; loginid?: string; name?: string; nickname?: string; profit?: number; followers?: number; [key: string]: any };

const CopyTrading = () => {
    const [traders, setTraders] = useState<Trader[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading copy-trading leaders…');

    const load = useCallback(async () => {
        if (!api_base.api) { setStatus('Connect a Deriv account to access copy trading.'); setLoading(false); return; }
        try {
            const response = await (api_base.api as any).send({ copytrading_list: 1, limit: 50 });
            const list = response?.copytrading_list || response?.list || response?.traders || [];
            setTraders(Array.isArray(list) ? list : []);
            setStatus(Array.isArray(list) && list.length ? 'Live leader list' : 'No leaders returned by Deriv for this account.');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Copy-trading service unavailable.');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const follow = async (id: string) => {
        try {
            await (api_base.api as any).send({ copytrading_start: id });
            setStatus(`Copy trading started for ${id}`);
        } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to start copy trading.'); }
    };

    return <div className='rm-tool'>
        <div className='rm-tool__header'><div><h2>Copy Trading</h2><span>Discover and follow available Deriv copy-trading leaders</span></div><button className='rm-button rm-button--secondary' onClick={load}>Refresh</button></div>
        <div className='rm-copy-status'>{status}</div>
        {loading ? <div className='rm-card rm-empty'>Loading leaders…</div> : <div className='rm-copy-grid'>{traders.map((t, i) => {
            const id = String(t.id || t.loginid || i);
            return <article className='rm-card rm-copy-card' key={id}><div className='rm-copy-card__avatar'>{(t.name || t.nickname || id).slice(0,1).toUpperCase()}</div><div><h3>{t.name || t.nickname || id}</h3><div className='rm-muted'>{t.loginid || id}</div><div className='rm-copy-stats'><span>Profit {typeof t.profit === 'number' ? t.profit.toFixed(2) : '—'}</span><span>Followers {t.followers ?? '—'}</span></div></div><button className='rm-button rm-button--primary' onClick={() => follow(id)}>Follow</button></article>;
        })}</div>}
    </div>;
};

export default CopyTrading;
