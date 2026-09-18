import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import './dtrader.scss';

type Tick = { epoch: number; quote: number; digit: number };
type ContractType =
    | 'CALL' | 'PUT' | 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER'
    | 'DIGITMATCH' | 'DIGITDIFF' | 'HIGHER' | 'LOWER' | 'TOUCH' | 'NOTOUCH';

const FALLBACK_MARKETS = [
    ['1HZ10V', 'Volatility 10 (1s) Index'],
    ['1HZ25V', 'Volatility 25 (1s) Index'],
    ['1HZ50V', 'Volatility 50 (1s) Index'],
    ['1HZ75V', 'Volatility 75 (1s) Index'],
    ['1HZ100V', 'Volatility 100 (1s) Index'],
    ['R_10', 'Volatility 10 Index'],
    ['R_25', 'Volatility 25 Index'],
    ['R_50', 'Volatility 50 Index'],
    ['R_75', 'Volatility 75 Index'],
    ['R_100', 'Volatility 100 Index'],
] as const;

const CONTRACTS: { id: ContractType; label: string }[] = [
    { id: 'CALL', label: 'Rise' }, { id: 'PUT', label: 'Fall' },
    { id: 'DIGITEVEN', label: 'Even' }, { id: 'DIGITODD', label: 'Odd' },
    { id: 'DIGITOVER', label: 'Over' }, { id: 'DIGITUNDER', label: 'Under' },
    { id: 'DIGITMATCH', label: 'Matches' }, { id: 'DIGITDIFF', label: 'Differs' },
    { id: 'HIGHER', label: 'Higher' }, { id: 'LOWER', label: 'Lower' },
    { id: 'TOUCH', label: 'Touch' }, { id: 'NOTOUCH', label: 'No Touch' },
];

const WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';

function digitFromQuote(quote: number, pipSize = 2) {
    return Math.abs(Math.round(quote * Math.pow(10, pipSize))) % 10;
}

function labelFor(type: ContractType, barrier: number) {
    if (type === 'CALL') return 'Rise';
    if (type === 'PUT') return 'Fall';
    if (type === 'DIGITEVEN') return 'Even';
    if (type === 'DIGITODD') return 'Odd';
    if (type === 'DIGITOVER') return 'Over ' + barrier;
    if (type === 'DIGITUNDER') return 'Under ' + barrier;
    if (type === 'DIGITMATCH') return 'Matches ' + barrier;
    if (type === 'DIGITDIFF') return 'Differs ' + barrier;
    if (type === 'HIGHER') return 'Higher ' + barrier;
    if (type === 'LOWER') return 'Lower ' + barrier;
    if (type === 'TOUCH') return 'Touch ' + barrier;
    return 'No Touch ' + barrier;
}

export default function DTrader() {
    const { client } = useStore();
    const [symbol, setSymbol] = useState('1HZ10V');
    const [markets, setMarkets] = useState<{ symbol: string; name: string }[]>(
        FALLBACK_MARKETS.map(([symbol, name]) => ({ symbol, name }))
    );
    const [ticks, setTicks] = useState<Tick[]>([]);
    const [type, setType] = useState<ContractType>('DIGITUNDER');
    const [barrier, setBarrier] = useState(6);
    const [duration, setDuration] = useState(5);
    const [stake, setStake] = useState(10);
    const [proposal, setProposal] = useState<any>(null);
    const [openContract, setOpenContract] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [windowSize, setWindowSize] = useState(100);
    const [feedState, setFeedState] = useState('CONNECTING');
    const [message, setMessage] = useState('');

    const wsRef = useRef<WebSocket | null>(null);
    const historyRef = useRef<Tick[]>([]);

    const live1000 = ticks.slice(-1000);
    const analysis = ticks.slice(-windowSize);
    const counts = useMemo(() => Array.from({ length: 10 }, (_, d) => live1000.filter(t => t.digit === d).length), [live1000]);
    const total = Math.max(1, live1000.length);
    const evenPct = live1000.filter(t => t.digit % 2 === 0).length / total * 100;
    const oddPct = 100 - evenPct;
    const last = live1000.length ? live1000[live1000.length - 1].digit : '—';

    const psychology = useMemo(() => {
        const n = Math.min(1000, ticks.length);
        if (!n) return { odd: 0, even: 0, under7: 0, over2: 0, danger: 100 };
        const a = ticks.slice(-n);
        const odd = a.filter(t => t.digit % 2).length / n * 100;
        const even = 100 - odd;
        const under7 = a.filter(t => t.digit <= 6).length / n * 100;
        const over2 = a.filter(t => t.digit >= 3).length / n * 100;
        const danger = Math.round(Math.min(100, Math.abs(50 - (type === 'DIGITUNDER' ? under7 : over2)) * 2 + (n < 1000 ? 25 : 0)));
        return { odd, even, under7, over2, danger };
    }, [ticks, type]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await (api_base.api as any)?.send?.({ active_symbols: 'brief' });
                const rows = Array.isArray(res?.active_symbols) ? res.active_symbols : [];
                const live = rows
                    .filter((m: any) => {
                        const s = String(m?.underlying_symbol || '');
                        const market = String(m?.market || '').toLowerCase();
                        return m?.underlying_symbol && (
                            market.includes('synthetic') || market.includes('derived') ||
                            /^(R_|1HZ|BOOM|CRASH|RDBULL|RDBEAR|JD|JUMP|STEP|RANGE)/.test(s)
                        );
                    })
                    .map((m: any) => ({ symbol: String(m.underlying_symbol), name: String(m.underlying_symbol_name || m.underlying_symbol) }));
                if (!cancelled && live.length) setMarkets(live);
            } catch {
                // The curated fallback remains available if metadata is unavailable.
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let closed = false;
        let ws: WebSocket;
        try { ws = new WebSocket(WS_URL); } catch { setFeedState('ERROR'); return; }
        wsRef.current = ws;
        setFeedState('CONNECTING');

        ws.onopen = () => {
            if (closed) return;
            setFeedState('LIVE');
            ws.send(JSON.stringify({ ticks_history: symbol, adjust_start_time: 1, count: 1000, end: 'latest', style: 'ticks' }));
            ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        };
        ws.onmessage = event => {
            if (closed) return;
            try {
                const msg = JSON.parse(event.data);
                if (msg.error) { setMessage(msg.error.message || 'Deriv feed error'); return; }
                if (msg.history) {
                    const prices = msg.history.prices || [];
                    const times = msg.history.times || [];
                    const seeded = prices.map((q: number, i: number) => ({ epoch: Number(times[i]), quote: Number(q), digit: digitFromQuote(Number(q), Number(msg.pip_size ?? 2)) }));
                    historyRef.current = seeded.slice(-1000);
                    setTicks(historyRef.current.slice());
                }
                if (msg.tick) {
                    const quote = Number(msg.tick.quote);
                    const tick = { epoch: Number(msg.tick.epoch), quote, digit: digitFromQuote(quote, Number(msg.tick.pip_size ?? 2)) };
                    historyRef.current = [...historyRef.current, tick].slice(-1000);
                    setTicks(historyRef.current.slice());
                }
            } catch {
                // Ignore malformed feed frames.
            }
        };
        ws.onerror = () => setFeedState('ERROR');
        ws.onclose = () => { if (!closed) setFeedState('RECONNECTING'); };
        return () => {
            closed = true;
            try { ws.close(); } catch {}
            wsRef.current = null;
        };
    }, [symbol]);

    useEffect(() => {
        if (!client?.is_logged_in || !api_base.api?.send) {
            setProposal(null);
            return;
        }
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const payload: Record<string, any> = {
                    proposal: 1, amount: stake, basis: 'stake', contract_type: type,
                    currency: client.currency || 'USD', duration, duration_unit: 't',
                    underlying_symbol: symbol,
                };
                if (['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF','HIGHER','LOWER','TOUCH','NOTOUCH'].includes(type)) payload.barrier = barrier;
                const res = await (api_base.api as any).send(payload);
                if (!cancelled) setProposal(res?.proposal || null);
            } catch (e: any) {
                if (!cancelled) { setProposal(null); setMessage(e?.message || 'Proposal request failed'); }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [client?.is_logged_in, client?.currency, symbol, type, barrier, duration, stake]);

    useEffect(() => {
        if (!openContract?.id || !api_base.api?.send) return;
        const timer = window.setInterval(async () => {
            try {
                const res = await (api_base.api as any).send({ proposal_open_contract: 1, contract_id: openContract.id });
                const c = res?.proposal_open_contract;
                if (!c) return;
                setOpenContract((p: any) => p ? { ...p, status: c.status, profit: Number(c.profit || 0), bid: Number(c.bid_price || 0), payout: Number(c.payout || 0) } : p);
                if (c.is_sold || c.is_expired || ['won','lost','sold','expired'].includes(c.status)) window.clearInterval(timer);
            } catch {}
        }, 1000);
        return () => window.clearInterval(timer);
    }, [openContract?.id]);

    async function buy() {
        if (!proposal?.id || !client?.is_logged_in) { setMessage('Log in to your Deriv account before buying.'); return; }
        try {
            const res = await (api_base.api as any).send({ buy: proposal.id, price: Number(proposal.ask_price) });
            const id = Number(res?.buy?.contract_id);
            if (!id) throw new Error(res?.error?.message || 'Deriv did not return a contract ID.');
            setOpenContract({ id, label: labelFor(type, barrier), status: 'open', profit: 0, bid: Number(proposal.ask_price) });
            setMessage('Contract purchased: ' + id);
        } catch (e: any) {
            setMessage(e?.message || 'Purchase failed.');
        }
    }

    async function sell() {
        if (!openContract?.id) return;
        try {
            await (api_base.api as any).send({ sell: openContract.id, price: 0 });
            setMessage('Sell request sent for contract ' + openContract.id);
        } catch (e: any) { setMessage(e?.message || 'Sell request failed.'); }
    }

    const filteredMarkets = markets.filter(m => (m.symbol + ' ' + m.name).toLowerCase().includes(search.toLowerCase()));

    return (
        <div className='dtrader'>
            <div className='dtrader__topbar'>
                <div><div className='dtrader__eyebrow'>SENTINEL</div><strong>DTrader</strong></div>
                <div className='dtrader__market-tabs'>
                    {markets.slice(0, 6).map(m => <button key={m.symbol} className={m.symbol === symbol ? 'active' : ''} onClick={() => setSymbol(m.symbol)}>{m.symbol}</button>)}
                </div>
                <div className={'dtrader__feed dtrader__feed--' + feedState.toLowerCase()}>{feedState}</div>
            </div>

            <div className='dtrader__toolbar'>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search synthetic / derived market…' />
                {search && <div className='dtrader__search-results'>{filteredMarkets.slice(0, 24).map(m => <button key={m.symbol} onClick={() => { setSymbol(m.symbol); setSearch(''); }}>{m.symbol} · {m.name}</button>)}</div>}
            </div>

            <div className='dtrader__grid'>
                <main>
                    <section className='dtrader__panel dtrader__chart'>
                        <div className='dtrader__panel-head'><span>{markets.find(m => m.symbol === symbol)?.name || symbol}</span><b>{(ticks.length ? ticks[ticks.length - 1].quote.toFixed(5) : '—')}</b></div>
                        <div className='dtrader__spark'>
                            {analysis.length > 1 ? <svg viewBox='0 0 100 30' preserveAspectRatio='none'><polyline fill='none' points={analysis.map((t, i) => `${i / (analysis.length - 1) * 100},${28 - ((t.quote - Math.min(...analysis.map(x => x.quote))) / Math.max(1e-9, Math.max(...analysis.map(x => x.quote)) - Math.min(...analysis.map(x => x.quote))) * 25)}`).join(' ')} /></svg> : <span>Waiting for live Deriv ticks…</span>}
                        </div>
                    </section>

                    <section className='dtrader__panel'>
                        <div className='dtrader__panel-head'><strong>0–9 LIVE DIGIT INTELLIGENCE · DERIV 1000 TICKS</strong><div className='dtrader__window'>{[20,50,100,120,500,1000].map(n => <button key={n} className={windowSize === n ? 'active' : ''} onClick={() => setWindowSize(n)}>{n}</button>)}</div></div>
                        <div className='dtrader__note'>Distribution = last {live1000.length} of the canonical 1000-tick feed · analysis window = {analysis.length}</div>
                        <div className='dtrader__digits'>{counts.map((c, d) => <div className='dtrader__digit' key={d}><b>{d}</b><i style={{ height: Math.max(4, c / total * 110) }} /><span>{(c / total * 100).toFixed(1)}%</span><small>{c}</small></div>)}</div>
                        <div className='dtrader__metrics'><Metric l='EVEN' v={evenPct.toFixed(1) + '%'} /><Metric l='ODD' v={oddPct.toFixed(1) + '%'} /><Metric l='LAST' v={String(last)} /><Metric l='SAMPLE' v={live1000.length + ' / 1000'} /><Metric l='FEED' v={feedState} /></div>
                    </section>

                    <section className='dtrader__panel'>
                        <div className='dtrader__panel-head'><strong>Sentinel + DigitPulse Intelligence</strong><span className='dtrader__badge'>LIVE DERIV FEED</span></div>
                        <div className='dtrader__metrics'><Metric l='UNDER 7 SUPPORT' v={psychology.under7.toFixed(1) + '%'} /><Metric l='OVER 2 SUPPORT' v={psychology.over2.toFixed(1) + '%'} /><Metric l='ODD / EVEN' v={psychology.odd.toFixed(1) + ' / ' + psychology.even.toFixed(1)} /><Metric l='DANGER' v={psychology.danger + ' / 100'} /><Metric l='TICKS' v={String(ticks.length)} /></div>
                    </section>

                    {openContract && <section className='dtrader__panel dtrader__open'><div><small>OPEN CONTRACT</small><strong>{openContract.label} · {openContract.id}</strong></div><Metric l='STATUS' v={openContract.status} /><Metric l='P/L' v={Number(openContract.profit || 0).toFixed(2)} /><Metric l='BID' v={Number(openContract.bid || 0).toFixed(2)} /><button onClick={sell} disabled={['won','lost','sold','expired'].includes(openContract.status)}>SELL</button></section>}
                </main>

                <aside className='dtrader__panel dtrader__deck'>
                    <h3>ADAPTIVE TRADE DECK</h3>
                    <label>CONTRACT</label>
                    <div className='dtrader__contracts'>{CONTRACTS.map(c => <button key={c.id} className={type === c.id ? 'active' : ''} onClick={() => setType(c.id)}>{c.label}</button>)}</div>
                    {['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF','HIGHER','LOWER','TOUCH','NOTOUCH'].includes(type) && <><label>{type.startsWith('DIGIT') ? 'DIGIT / BARRIER' : 'BARRIER'}</label><input type='number' value={barrier} min={0} max={9} onChange={e => setBarrier(Number(e.target.value))} /></>}
                    <label>DURATION</label><div className='dtrader__durations'>{[1,2,3,5,10].map(n => <button key={n} className={duration === n ? 'active' : ''} onClick={() => setDuration(n)}>{n}t</button>)}</div>
                    <label>STAKE</label><input type='number' value={stake} min={0.35} step={0.01} onChange={e => setStake(Math.max(0.35, Number(e.target.value)))} />
                    <div className='dtrader__quote'><Metric l='MARKET' v={symbol} /><Metric l='CONTRACT' v={labelFor(type, barrier)} /><Metric l='ASK' v={loading ? '…' : proposal?.ask_price != null ? Number(proposal.ask_price).toFixed(2) : '—'} /><Metric l='PAYOUT' v={proposal?.payout != null ? Number(proposal.payout).toFixed(2) : '—'} /></div>
                    <button className='dtrader__buy' onClick={buy} disabled={!proposal?.id || loading || !!openContract}>{client?.is_logged_in ? 'BUY ' + labelFor(type, barrier).toUpperCase() : 'CONNECT DERIV ACCOUNT'}</button>
                    {message && <div className='dtrader__message'>{message}</div>}
                    <small>Manual execution only. This cockpit never buys automatically.</small>
                </aside>
            </div>
        </div>
    );
}

function Metric({ l, v }: { l: string; v: string }) {
    return <div className='dtrader__metric'><small>{l}</small><b>{v}</b></div>;
}
