import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ChartTitle, SmartChart, TGranularity } from '@deriv-com/smartcharts-champion';
import { useDevice } from '@deriv-com/ui';
import { useSmartChartAdaptor } from '@/hooks/useSmartChartAdaptor';
import { generateOAuthURL } from '@/components/shared';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
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

function digitFromQuote(quote: number, decimals = 2) {
    const fixed = Math.abs(quote).toFixed(Math.max(0, decimals));
    return Number(fixed.charAt(fixed.length - 1)) || 0;
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

export default observer(function DTrader() {
    const { client, common, ui } = useStore();
    const { isDesktop, isMobile } = useDevice();
    const { chartData, getQuotes, subscribeQuotes, unsubscribeQuotes } = useSmartChartAdaptor();
    const [symbol, setSymbol] = useState('1HZ10V');
    const [markets, setMarkets] = useState<any[]>(FALLBACK_MARKETS.map(([symbol, name]) => ({ symbol, name, market: 'synthetic_index', pip_size: 0.01 })));
    const [marketOpen, setMarketOpen] = useState(false);
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


    const live1000 = ticks.slice(-1000);
    const analysis = ticks.slice(-windowSize);
    const counts = useMemo(() => Array.from({ length: 10 }, (_, d) => live1000.filter(t => t.digit === d).length), [live1000]);
    const total = Math.max(1, live1000.length);
    const evenPct = live1000.filter(t => t.digit % 2 === 0).length / total * 100;
    const oddPct = 100 - evenPct;
    const last = live1000.length ? live1000[live1000.length - 1].digit : '—';
    const selectedMarket = markets.find(m => m.symbol === symbol) || markets[0];
    const decimals = selectedMarket?.pip_size ? Math.max(0, Math.round(-Math.log10(Number(selectedMarket.pip_size)))) : 2;

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
                if (!chart_api.api) await chart_api.init();
                const res = await chart_api.api?.send({ active_symbols: 'brief' });
                const rows = Array.isArray(res?.active_symbols) ? res.active_symbols : [];
                const live = rows.filter((m: any) => {
                    const s = String(m?.underlying_symbol || '');
                    const market = String(m?.market || '').toLowerCase();
                    return s && (market.includes('synthetic') || market.includes('derived') || /^(R_|1HZ|BOOM|CRASH|RDBULL|RDBEAR|JD|JUMP|STEP|RANGE)/.test(s));
                }).map((m: any) => ({ symbol: String(m.underlying_symbol), name: String(m.display_name || m.underlying_symbol), market: String(m.market || 'synthetic_index'), pip_size: Number(m.pip_size || m.pip || 0.01) }));
                if (!cancelled && live.length) setMarkets(live);
            } catch {}
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        setFeedState('LOADING');
        (async () => {
            try {
                const response = await getQuotes({ symbol, granularity: 0, count: 1000 });
                const prices = response?.history?.prices || [];
                if (cancelled) return;
                setTicks(prices.map((q: number) => ({ epoch: 0, quote: Number(q), digit: digitFromQuote(Number(q), decimals) })).slice(-1000));
                setFeedState('LIVE');
                unsubscribe = subscribeQuotes({ symbol, granularity: 0 }, (quote: any) => {
                    if (cancelled) return;
                    const price = Number(quote?.Close ?? quote?.quote ?? quote?.price);
                    if (!Number.isFinite(price)) return;
                    setTicks(previous => [...previous, { epoch: Number(quote?.Date || Date.now() / 1000), quote: price, digit: digitFromQuote(price, decimals) }].slice(-1000));
                    setFeedState('LIVE');
                });
            } catch {
                if (!cancelled) setFeedState('ERROR');
            }
        })();
        return () => {
            cancelled = true;
            try { unsubscribe?.(); } catch {}
            try { unsubscribeQuotes({ symbol, granularity: 0 }); } catch {}
        };
    }, [symbol, decimals, getQuotes, subscribeQuotes, unsubscribeQuotes]);

    useEffect(() => {
        if (!client?.is_logged_in || !chart_api.api?.send) {
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
                const res = await chart_api.api.send(payload);
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
        if (!openContract?.id || !chart_api.api?.send) return;
        const timer = window.setInterval(async () => {
            try {
                const res = await chart_api.api.send({ proposal_open_contract: 1, contract_id: openContract.id });
                const c = res?.proposal_open_contract;
                if (!c) return;
                setOpenContract((p: any) => p ? { ...p, status: c.status, profit: Number(c.profit || 0), bid: Number(c.bid_price || 0), payout: Number(c.payout || 0) } : p);
                if (c.is_sold || c.is_expired || ['won','lost','sold','expired'].includes(c.status)) window.clearInterval(timer);
            } catch {}
        }, 1000);
        return () => window.clearInterval(timer);
    }, [openContract?.id]);

    async function connectAccount() {
        try {
            const url = await generateOAuthURL();
            if (url) window.location.replace(url);
            else setMessage('Unable to start Deriv account connection.');
        } catch (e: any) {
            setMessage(e?.message || 'Unable to start Deriv account connection.');
        }
    }

    async function buy() {
        if (!proposal?.id || !client?.is_logged_in) { setMessage('Log in to your Deriv account before buying.'); return; }
        try {
            const res = await chart_api.api.send({ buy: proposal.id, price: Number(proposal.ask_price) });
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
            await chart_api.api.send({ sell: openContract.id, price: 0 });
            setMessage('Sell request sent for contract ' + openContract.id);
        } catch (e: any) { setMessage(e?.message || 'Sell request failed.'); }
    }

    function isBarrierValid() {
        if (!['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(type)) return true;
        if (type === 'DIGITUNDER') return barrier >= 0 && barrier <= 8;
        if (type === 'DIGITOVER') return barrier >= 1 && barrier <= 9;
        return barrier >= 0 && barrier <= 9;
    }

    const filteredMarkets = markets.filter(m => (m.symbol + ' ' + m.name).toLowerCase().includes(search.toLowerCase()));

    const chartSettings = { assetInformation: false, countdown: true, isHighestLowestMarkerEnabled: false, language: common.current_language.toLowerCase(), position: ui.is_chart_layout_default ? 'bottom' : 'left', theme: ui.is_dark_mode_on ? 'dark' : 'light' };

    return (
        <div className='dtrader dtrader--real'>
            <div className='dt-header'>
                <div className='dt-brand'><div className='dt-brand-mark'>S</div><div><strong>DTrader</strong><span>Sentinel trading cockpit</span></div></div>
                <div className='dt-market-picker-wrap'>
                    <button className='dt-market-picker' onClick={() => setMarketOpen(v => !v)}><b>{symbol}</b><span>{selectedMarket?.name || symbol}</span><em>⌄</em></button>
                    {marketOpen && <div className='dt-market-menu'><div className='dt-search'><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder='Search synthetic / derived markets…' /><button onClick={() => setMarketOpen(false)}>×</button></div><div className='dt-market-list'>{filteredMarkets.slice(0, 80).map(m => <button key={m.symbol} className={m.symbol === symbol ? 'selected' : ''} onClick={() => { setSymbol(m.symbol); setMarketOpen(false); setSearch(''); }}><strong>{m.symbol}</strong><span>{m.name}</span></button>)}</div></div>}
                </div>
                <div className='dt-header-status'><i className={feedState.toLowerCase()} />{feedState}<span>{client?.loginid || 'Demo account'}</span></div>
            </div>

            <div className='dtrader__grid'>
                <main>
                    <section className='dt-chart-card'>
                        <div className='dt-chart-head'><div><small>LIVE MARKET</small><strong>{selectedMarket?.name || symbol}</strong></div><b>{livePrice(ticks, decimals)}</b></div>
                        <div className='dt-chart'>{chartData.activeSymbols.length ? <SmartChart id={'sentinel-dtrader-' + symbol} key={'sentinel-dtrader-' + symbol} symbol={symbol} barriers={[]} chartType='line' granularity={0 as TGranularity} isLive isMobile={isMobile} isConnectionOpened={!!chart_api.api} getQuotes={getQuotes} subscribeQuotes={subscribeQuotes} unsubscribeQuotes={unsubscribeQuotes} chartData={{ activeSymbols: chartData.activeSymbols, tradingTimes: chartData.tradingTimes }} settings={chartSettings} topWidgets={() => <ChartTitle onChange={() => undefined} />} enabledNavigationWidget={isDesktop} enabledChartFooter={false} showLastDigitStats={false} /> : <div className='dt-chart-loading'>Connecting to live Deriv market data…</div>}</div>
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
                    <button className='dtrader__buy' onClick={client?.is_logged_in ? buy : connectAccount} disabled={client?.is_logged_in ? (!proposal?.id || loading || !!openContract || !isBarrierValid()) : false}>{client?.is_logged_in ? 'BUY ' + labelFor(type, barrier).toUpperCase() : 'CONNECT DERIV ACCOUNT'}</button>
                    {message && <div className='dtrader__message'>{message}</div>}
                    <small>Manual execution only. This cockpit never buys automatically.</small>
                </aside>
            </div>
        </div>
    );
});

function livePrice(ticks: Tick[], decimals: number) { const value = ticks.length ? ticks[ticks.length - 1].quote : null; return value == null ? '—' : value.toFixed(decimals); }

function Metric({ l, v }: { l: string; v: string }) {
    return <div className='dtrader__metric'><small>{l}</small><b>{v}</b></div>;
}
