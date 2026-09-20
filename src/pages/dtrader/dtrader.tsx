import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { SmartChart, TGranularity } from '@deriv-com/smartcharts-champion';
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

const TERMINAL_STATUSES = ['won', 'lost', 'sold', 'expired'];
const TREND_WINDOW = 60;

/**
 * Colour-classifies each of the 10 digits against the current distribution:
 *  - is-most / is-second-most  -> highest / 2nd highest frequency in the window
 *  - is-least / is-second-least -> lowest / 2nd lowest frequency in the window
 *  - is-trend                   -> steepest rising frequency over the trailing 60 ticks
 * Priority when a digit qualifies for more than one: trend > most > least > second-most > second-least.
 * Everything else is left unclassified (plain).
 */
function classifyDigits(counts: number[], recentTicks: Tick[]) {
    const byCount = counts.map((c, d) => ({ d, c }));
    const desc = [...byCount].sort((a, b) => b.c - a.c || a.d - b.d);
    const asc = [...byCount].sort((a, b) => a.c - b.c || a.d - b.d);
    const mostDigit = desc[0]?.c > 0 ? desc[0].d : null;
    const secondMostDigit = desc[1]?.c > 0 ? desc[1].d : null;
    const leastDigit = asc[0] ? asc[0].d : null;
    const secondLeastDigit = asc[1] ? asc[1].d : null;

    let trendDigit: number | null = null;
    const sample = recentTicks.slice(-TREND_WINDOW);
    if (sample.length >= 10) {
        const mid = Math.floor(sample.length / 2);
        const firstHalf = sample.slice(0, mid);
        const secondHalf = sample.slice(mid);
        const rate = (half: Tick[], d: number) => half.filter(t => t.digit === d).length / Math.max(1, half.length);
        let bestDelta = 0;
        for (let d = 0; d < 10; d++) {
            const delta = rate(secondHalf, d) - rate(firstHalf, d);
            if (delta > bestDelta) { bestDelta = delta; trendDigit = d; }
        }
    }

    const classOf: string[] = new Array(10).fill('');
    for (let d = 0; d < 10; d++) {
        if (d === trendDigit) classOf[d] = 'is-trend';
        else if (d === mostDigit) classOf[d] = 'is-most';
        else if (d === leastDigit) classOf[d] = 'is-least';
        else if (d === secondMostDigit) classOf[d] = 'is-second-most';
        else if (d === secondLeastDigit) classOf[d] = 'is-second-least';
    }
    return classOf;
}

type SentinelSignal = { type: ContractType; barrier: number; label: string; confidence: number; edge: number };

/**
 * Ranks a handful of natural contract shapes (Even/Odd, Over/Under each barrier) against the
 * current analysis window, comparing observed win-rate to the barrier's theoretical baseline.
 * This surfaces the strongest recent statistical bias — it is descriptive of the sample, not a
 * guarantee, since these are synthetic, contractually-random indices.
 */
function computeSentinelSignal(analysisTicks: Tick[]): SentinelSignal | null {
    const n = analysisTicks.length;
    if (n < 20) return null;
    const counts = new Array(10).fill(0);
    for (const t of analysisTicks) counts[t.digit]++;
    const candidates: SentinelSignal[] = [];

    const evenN = counts.reduce((sum, c, d) => sum + (d % 2 === 0 ? c : 0), 0);
    const oddN = n - evenN;
    candidates.push({ type: 'DIGITEVEN', barrier: 0, label: 'Even', confidence: 0, edge: evenN / n - 0.5 });
    candidates.push({ type: 'DIGITODD', barrier: 0, label: 'Odd', confidence: 0, edge: oddN / n - 0.5 });

    for (let b = 1; b <= 9; b++) {
        const under = counts.slice(0, b).reduce((a, c) => a + c, 0);
        candidates.push({ type: 'DIGITUNDER', barrier: b, label: 'Under ' + b, confidence: 0, edge: under / n - b / 10 });
    }
    for (let b = 0; b <= 8; b++) {
        const over = counts.slice(b + 1).reduce((a, c) => a + c, 0);
        candidates.push({ type: 'DIGITOVER', barrier: b, label: 'Over ' + b, confidence: 0, edge: over / n - (9 - b) / 10 });
    }

    const best = candidates.reduce((a, b) => (b.edge > a.edge ? b : a));
    if (best.edge <= 0.015) return null;
    const confidence = Math.max(1, Math.min(97, Math.round(best.edge * 100 * Math.sqrt(n / 40))));
    return { ...best, confidence };
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
    const { adapterInitialized, chartData, getQuotes, subscribeQuotes, unsubscribeQuotes, error: chartError } = useSmartChartAdaptor();
    const initialSymbol = useMemo(() => {
        try {
            const fromUrl = new URLSearchParams(window.location.search).get('symbol');
            return fromUrl && fromUrl.trim() ? fromUrl.trim() : '1HZ10V';
        } catch {
            return '1HZ10V';
        }
    }, []);
    const [symbol, setSymbol] = useState(initialSymbol);
    const [markets, setMarkets] = useState<any[]>([]);
    const [marketOpen, setMarketOpen] = useState(false);
    const [ticks, setTicks] = useState<Tick[]>([]);
    const [type, setType] = useState<ContractType>('DIGITUNDER');
    const [barrier, setBarrier] = useState(6);
    const [duration, setDuration] = useState(1);
    const [stake, setStake] = useState(10);
    const [proposal, setProposal] = useState<any>(null);
    const [openContracts, setOpenContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [windowSize, setWindowSize] = useState(1000);
    const [feedState, setFeedState] = useState('CONNECTING');
    const [message, setMessage] = useState('');
    const [entryDigit, setEntryDigit] = useState<number | ''>('');
    const [armed, setArmed] = useState(false);


    const live1000 = useMemo(() => (ticks.length > 1000 ? ticks.slice(-1000) : ticks), [ticks]);
    // `analysis` is the tick slice the person actually selected via the window buttons (20/50/.../1000) —
    // this drives the digit distribution below instead of always the full 1000-tick buffer.
    const analysis = useMemo(() => ticks.slice(-windowSize), [ticks, windowSize]);
    const { counts, evenCount } = useMemo(() => {
        const next = new Array(10).fill(0) as number[];
        let even = 0;
        for (let i = 0; i < analysis.length; i++) {
            const d = analysis[i].digit;
            next[d]++;
            if (d % 2 === 0) even++;
        }
        return { counts: next, evenCount: even };
    }, [analysis]);
    const total = Math.max(1, analysis.length);
    const evenPct = (evenCount / total) * 100;
    const oddPct = 100 - evenPct;
    const digitClasses = useMemo(() => classifyDigits(counts, ticks), [counts, ticks]);
    const sentinelSignal = useMemo(() => computeSentinelSignal(analysis), [analysis]);
    const last = live1000.length ? live1000[live1000.length - 1].digit : null;
    const [pulseDigit, setPulseDigit] = useState<number | null>(null);
    const pulseTimerRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (last == null) return;
        setPulseDigit(last);
        window.clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = window.setTimeout(() => setPulseDigit(null), 380);
        return () => window.clearTimeout(pulseTimerRef.current);
    }, [last, ticks.length]);
    const selectedMarket = markets.find(m => m.symbol === symbol);
    const decimals = selectedMarket?.pip_size ? Math.max(0, Math.round(-Math.log10(Number(selectedMarket.pip_size)))) : 2;
    // Keep digit formatting current without making the tick subscription restart when
    // market metadata updates pip_size after mount.
    const decimalsRef = useRef(decimals);
    useEffect(() => {
        decimalsRef.current = decimals;
    }, [decimals]);

    const psychology = useMemo(() => {
        const n = Math.min(1000, ticks.length);
        if (!n) return { odd: 0, even: 0, under7: 0, over2: 0, danger: 100 };
        let odd_n = 0;
        let under7_n = 0;
        let over2_n = 0;
        for (let i = ticks.length - n; i < ticks.length; i++) {
            const d = ticks[i].digit;
            if (d % 2) odd_n++;
            if (d <= 6) under7_n++;
            if (d >= 3) over2_n++;
        }
        const odd = (odd_n / n) * 100;
        const even = 100 - odd;
        const under7 = (under7_n / n) * 100;
        const over2 = (over2_n / n) * 100;
        const danger = Math.round(Math.min(100, Math.abs(50 - (type === 'DIGITUNDER' ? under7 : over2)) * 2 + (n < 1000 ? 25 : 0)));
        return { odd, even, under7, over2, danger };
    }, [ticks, type]);

    useEffect(() => {
        if (!chartData.activeSymbols.length) return;
        const live = chartData.activeSymbols.map((m: any) => ({
            symbol: String(m.underlying_symbol || m.symbol),
            name: String(m.display_name || m.name || m.underlying_symbol || m.symbol),
            market: String(m.market || 'synthetic_index'),
            pip_size: Number(m.pip_size || m.pip || 0.01),
        })).filter((m: any) => m.symbol);
        if (live.length) {
            setMarkets(live);
            if (!live.some(m => m.symbol === symbol)) setSymbol(live[0].symbol);
        }
    }, [chartData.activeSymbols]);

    const quotesRef = useRef({ getQuotes, subscribeQuotes, unsubscribeQuotes });
    useEffect(() => {
        quotesRef.current = { getQuotes, subscribeQuotes, unsubscribeQuotes };
    }, [getQuotes, subscribeQuotes, unsubscribeQuotes]);

    useEffect(() => {
        if (!adapterInitialized) return;
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        setFeedState('LOADING');
        (async () => {
            try {
                const response = await quotesRef.current.getQuotes({ symbol, granularity: 0, count: 1000 });
                const prices = response?.history?.prices || [];
                if (cancelled) return;
                setTicks(prices.map((q: number) => ({ epoch: 0, quote: Number(q), digit: digitFromQuote(Number(q), decimalsRef.current) })).slice(-1000));
                setFeedState('LIVE');
                unsubscribe = quotesRef.current.subscribeQuotes({ symbol, granularity: 0 }, (quote: any) => {
                    if (cancelled) return;
                    const price = Number(quote?.Close ?? quote?.quote ?? quote?.price);
                    if (!Number.isFinite(price)) return;
                    setTicks(previous => [...previous, { epoch: Number(quote?.Date || Date.now() / 1000), quote: price, digit: digitFromQuote(price, decimalsRef.current) }].slice(-1000));
                    setFeedState('LIVE');
                });
            } catch {
                if (!cancelled) setFeedState('ERROR');
            }
        })();
        return () => {
            cancelled = true;
            try { unsubscribe?.(); } catch {}
            try { quotesRef.current.unsubscribeQuotes({ symbol, granularity: 0 }); } catch {}
        };
    }, [symbol, adapterInitialized]);

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

    // Poll every open, unresolved contract's status once a second. This used to lock the whole
    // Buy button on a single open contract until it settled. Contracts are now tracked independently.
    const openContractsRef = useRef<any[]>([]);
    useEffect(() => { openContractsRef.current = openContracts; }, [openContracts]);
    useEffect(() => {
        if (!chart_api.api?.send) return;
        const failureCounts = new Map<number, number>();
        const startTimes = new Map<number, number>();
        const STALL_TIMEOUT_MS = 3 * 60 * 1000;
        const timer = window.setInterval(async () => {
            const pending = openContractsRef.current.filter(c => !TERMINAL_STATUSES.includes(c.status) && !c.stale);
            for (const c of pending) {
                if (!startTimes.has(c.id)) startTimes.set(c.id, Date.now());
                try {
                    const res = await chart_api.api.send({ proposal_open_contract: 1, contract_id: c.id });
                    const pc = res?.proposal_open_contract;
                    if (res?.error) throw new Error(res.error.message || 'Contract status request failed');
                    failureCounts.set(c.id, 0);
                    if (!pc) continue;
                    setOpenContracts(prev => prev.map(x => x.id === c.id ? { ...x, status: pc.status, profit: Number(pc.profit || 0), bid: Number(pc.bid_price || 0), payout: Number(pc.payout || 0), stale: false } : x));
                } catch {
                    const n = (failureCounts.get(c.id) || 0) + 1;
                    failureCounts.set(c.id, n);
                    if (n >= 5) {
                        setMessage('Losing connection to a contract’s status — check Reports in your Deriv account.');
                        setOpenContracts(prev => prev.map(x => x.id === c.id ? { ...x, stale: true } : x));
                    }
                } finally {
                    if (Date.now() - (startTimes.get(c.id) || Date.now()) > STALL_TIMEOUT_MS) {
                        setOpenContracts(prev => prev.map(x => x.id === c.id ? { ...x, stale: true } : x));
                    }
                }
            }
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const settled = openContracts.filter(c => TERMINAL_STATUSES.includes(c.status) || c.stale);
        if (!settled.length) return;
        const t = window.setTimeout(() => {
            setOpenContracts(prev => prev.filter(x => !(TERMINAL_STATUSES.includes(x.status) || x.stale)));
        }, 6000);
        return () => window.clearTimeout(t);
    }, [openContracts]);

    useEffect(() => {
        if (!armed || entryDigit === '' || !ticks.length) return;
        const last = ticks[ticks.length - 1];
        if (last.digit !== entryDigit) return;
        setArmed(false);
        void buy();
    }, [ticks, armed, entryDigit]);

    function applySentinelSignal() {
        if (!sentinelSignal) return;
        setType(sentinelSignal.type);
        if (sentinelSignal.type === 'DIGITOVER' || sentinelSignal.type === 'DIGITUNDER') setBarrier(sentinelSignal.barrier);
    }

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
        if (!client?.is_logged_in) { setMessage('Log in to your Deriv account before buying.'); return; }
        try {
            // The displayed proposal is for quoting only. It may be stale by the time RUN is
            // pressed, especially after entry-digit arming. Request a fresh proposal immediately
            // before purchase so the buy uses a currently valid ask price.
            const payload: Record<string, any> = {
                proposal: 1, amount: stake, basis: 'stake', contract_type: type,
                currency: client.currency || 'USD', duration, duration_unit: 't',
                underlying_symbol: symbol,
            };
            if (['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF','HIGHER','LOWER','TOUCH','NOTOUCH'].includes(type)) payload.barrier = barrier;
            const fresh = await chart_api.api.send(payload);
            const p = fresh?.proposal;
            if (!p?.id) throw new Error(fresh?.error?.message || 'Could not get a live price for this contract right now.');
            const res = await chart_api.api.send({ buy: p.id, price: Number(p.ask_price) });
            const id = Number(res?.buy?.contract_id);
            if (!id) throw new Error(res?.error?.message || 'Deriv did not return a contract ID.');
            setOpenContracts(prev => [{ id, label: labelFor(type, barrier), status: 'open', profit: 0, bid: Number(p.ask_price) }, ...prev].slice(0, 20));
            setMessage('Contract purchased: ' + id);
        } catch (e: any) {
            setMessage((typeof e?.message === 'string' && e.message) ? e.message : 'Purchase failed — please try again.');
        }
    }

    async function sell(contractId: number) {
        try {
            await chart_api.api.send({ sell: contractId, price: 0 });
            setMessage('Sell request sent for contract ' + contractId);
        } catch (e: any) { setMessage(e?.message || 'Sell request failed.'); }
    }

    function isBarrierValid() {
        if (!['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(type)) return true;
        if (type === 'DIGITUNDER') return barrier >= 0 && barrier <= 8;
        if (type === 'DIGITOVER') return barrier >= 1 && barrier <= 9;
        return barrier >= 0 && barrier <= 9;
    }

    const filteredMarkets = markets.filter(m => (m.symbol + ' ' + m.name).toLowerCase().includes(search.toLowerCase()));

    const chartSettings = useMemo(() => ({ assetInformation: false, countdown: true, isHighestLowestMarkerEnabled: false, language: common.current_language.toLowerCase(), position: ui.is_chart_layout_default ? 'bottom' : 'left', theme: ui.is_dark_mode_on ? 'dark' : 'light' }), [common.current_language, ui.is_chart_layout_default, ui.is_dark_mode_on]);
    const smartChartData = useMemo(() => ({ activeSymbols: chartData.activeSymbols, tradingTimes: chartData.tradingTimes }), [chartData.activeSymbols, chartData.tradingTimes]);

    return (
        <div className='dtrader dtrader--real'>
            <div className='dt-header'>
                <div className='dt-brand'><div><strong>DTrader</strong><span>Live Deriv trading terminal</span></div></div>
                <div className='dt-market-picker-wrap'>
                    <button className='dt-market-picker' disabled={!markets.length} onClick={() => setMarketOpen(v => !v)}><b>{symbol}</b><span>{selectedMarket?.name || (markets.length ? 'Loading market…' : 'Waiting for live markets…')}</span><em>⌄</em></button>
                    {marketOpen && markets.length > 0 && <div className='dt-market-menu'><div className='dt-search'><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder='Search synthetic / derived markets…' /><button onClick={() => setMarketOpen(false)}>×</button></div><div className='dt-market-list'>{filteredMarkets.slice(0, 80).map(m => <button key={m.symbol} className={m.symbol === symbol ? 'selected' : ''} onClick={() => { setSymbol(m.symbol); setMarketOpen(false); setSearch(''); }}><strong>{m.symbol}</strong><span>{m.name}</span></button>)}</div></div>}
                </div>
                <div className='dt-header-status'><i className={feedState.toLowerCase()} />{feedState}<span>{client?.loginid || 'Demo account'}</span></div>
            </div>

            <div className='dtrader__grid'>
                <main>
                    <section className='dt-chart-card'>
                        <div className='dt-chart-head'><div><small>LIVE MARKET</small><strong>{selectedMarket?.name || symbol}</strong></div><b>{livePrice(ticks, decimals)}</b></div>
                        <div className='dt-chart'>{adapterInitialized && chartData.activeSymbols.length ? <SmartChart id={'sentinel-dtrader-' + symbol} key={'sentinel-dtrader-' + symbol} symbol={symbol} barriers={[]} chartType='line' granularity={0 as TGranularity} isLive isMobile={isMobile} isConnectionOpened={!!chart_api.api} getQuotes={getQuotes} subscribeQuotes={subscribeQuotes} unsubscribeQuotes={unsubscribeQuotes} chartData={smartChartData} settings={chartSettings} enabledNavigationWidget={false} enabledChartFooter={false} showLastDigitStats={false} topWidgets={() => <></>} chartControlsWidgets={null} /> : <LiveChartFallback ticks={ticks} decimals={decimals} state={chartError ? 'Chart metadata unavailable — live tick feed is still active.' : !adapterInitialized ? 'Connecting to Deriv chart services…' : 'Loading Deriv market metadata…'} />}</div>
                    </section>

                    <section className='dtrader__panel'>
                        <div className='dtrader__panel-head'><strong>0–9 LIVE DIGIT INTELLIGENCE</strong><div className='dtrader__window'>{[20,50,100,120,500,1000].map(n => <button key={n} className={windowSize === n ? 'active' : ''} onClick={() => setWindowSize(n)}>{n}</button>)}</div></div>
                        <div className='dtrader__note'>Distribution over the last {analysis.length} of {windowSize} selected ticks · live buffer holds {live1000.length} / 1000</div>
                        <div className='dtrader__digits' style={last != null ? ({ '--last-index': last } as React.CSSProperties) : undefined}>
                            {counts.map((c, d) => {
                                const pct = (c / total) * 100;
                                return (
                                    <div className={'dtrader__digit ' + digitClasses[d] + (d === last ? ' is-last' : '') + (d === pulseDigit ? ' is-pulse' : '')} key={d}>
                                        <div className='dtrader__digit-ring' style={{ '--pct': pct } as React.CSSProperties}>
                                            <div className='dtrader__digit-ring-inner'><b>{d}</b></div>
                                        </div>
                                        <span>{pct.toFixed(1)}%</span>
                                    </div>
                                );
                            })}
                            {last != null && <i className='dtrader__digit-marker' />}
                        </div>
                        <div className='dtrader__legend'>
                            <span className='is-most'>Most frequent</span>
                            <span className='is-second-most'>2nd most</span>
                            <span className='is-least'>Least frequent</span>
                            <span className='is-second-least'>2nd least</span>
                            <span className='is-trend'>Rising fastest (60t)</span>
                        </div>
                        <div className='dtrader__metrics'><Metric l='EVEN' v={evenPct.toFixed(1) + '%'} /><Metric l='ODD' v={oddPct.toFixed(1) + '%'} /><Metric l='LAST' v={last == null ? '—' : String(last)} /><Metric l='SAMPLE' v={analysis.length + ' / ' + windowSize} /><Metric l='FEED' v={feedState} /></div>
                    </section>

                    <section className='dtrader__panel dtrader__sentinel'>
                        <div className='dtrader__panel-head'><strong>Sentinel + DigitPulse Intelligence</strong><span className='dtrader__badge'>LIVE DERIV FEED</span></div>
                        {sentinelSignal ? (
                            <div className='dtrader__signal'>
                                <div>
                                    <small>TOP SIGNAL · {analysis.length}-TICK WINDOW</small>
                                    <strong>{sentinelSignal.label}</strong>
                                    <span>{(sentinelSignal.edge * 100).toFixed(1)}pp above baseline</span>
                                </div>
                                <div className='dtrader__signal-confidence'><b>{sentinelSignal.confidence}%</b><small>confidence</small></div>
                                <button onClick={applySentinelSignal}>Apply to deck</button>
                            </div>
                        ) : (
                            <div className='dtrader__signal dtrader__signal--flat'>No signal clears the baseline right now — distribution is close to random.</div>
                        )}
                        <div className='dtrader__metrics'><Metric l='UNDER 7 SUPPORT' v={psychology.under7.toFixed(1) + '%'} /><Metric l='OVER 2 SUPPORT' v={psychology.over2.toFixed(1) + '%'} /><Metric l='ODD / EVEN' v={psychology.odd.toFixed(1) + ' / ' + psychology.even.toFixed(1)} /><Metric l='DANGER' v={psychology.danger + ' / 100'} /><Metric l='TICKS' v={String(ticks.length)} /></div>
                        <small className='dtrader__disclaimer'>Statistical bias vs. baseline only — synthetic indices are contractually random and past digits don't guarantee the next one. Manual execution only.</small>
                    </section>

                    {openContracts.length > 0 && (
                        <section className='dtrader__panel dtrader__open-list'>
                            <div className='dtrader__open-list-title'><small>OPEN CONTRACTS</small></div>
                            {openContracts.map(oc => {
                                const resolved = TERMINAL_STATUSES.includes(oc.status);
                                return (
                                    <div key={oc.id} className={'dtrader__open' + (resolved ? ' is-resolved is-' + oc.status : '') + (oc.stale ? ' is-stale' : '')}>
                                        <div><small>{resolved ? 'CONTRACT ' + oc.status.toUpperCase() : oc.stale ? 'STATUS UNKNOWN' : 'OPEN CONTRACT'}</small><strong>{oc.label} · {oc.id}</strong></div>
                                        <Metric l='STATUS' v={oc.status} />
                                        <Metric l='P/L' v={Number(oc.profit || 0).toFixed(2)} />
                                        <Metric l='BID' v={Number(oc.bid || 0).toFixed(2)} />
                                        <button onClick={() => sell(oc.id)} disabled={resolved} title='Close this contract now at the current market price instead of waiting for expiry'>{resolved ? 'CLOSED' : 'SELL NOW'}</button>
                                        {(resolved || oc.stale) && <button className='dtrader__dismiss' onClick={() => setOpenContracts(prev => prev.filter(x => x.id !== oc.id))} aria-label='Dismiss'>×</button>}
                                    </div>
                                );
                            })}
                        </section>
                    )}
                </main>

                <aside className='dtrader__panel dtrader__deck'>
                    <h3>ADAPTIVE TRADE DECK</h3>
                    <label>CONTRACT</label>
                    <div className='dtrader__contracts'>{CONTRACTS.map(c => <button key={c.id} className={type === c.id ? 'active' : ''} onClick={() => setType(c.id)}>{c.label}</button>)}</div>
                    {['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF','HIGHER','LOWER','TOUCH','NOTOUCH'].includes(type) && <><label>{type.startsWith('DIGIT') ? 'DIGIT / BARRIER' : 'BARRIER'}</label><input type='number' value={barrier} min={0} max={9} onChange={e => setBarrier(Number(e.target.value))} /></>}
                    <label>DERIV DURATION TICKS</label><div className='dtrader__durations'>{[1,2,3,4,5].map(n => <button key={n} className={duration === n ? 'active' : ''} onClick={() => setDuration(n)}>{n}t</button>)}</div>
                    <label>STAKE</label><input type='number' value={stake} min={0.35} step={0.01} onChange={e => setStake(Math.max(0.35, Number(e.target.value)))} />
                    <div className='dtrader__quote'><Metric l='MARKET' v={symbol} /><Metric l='CONTRACT' v={labelFor(type, barrier)} /><Metric l='ASK' v={loading ? '…' : proposal?.ask_price != null ? Number(proposal.ask_price).toFixed(2) : '—'} /><Metric l='PAYOUT' v={proposal?.payout != null ? Number(proposal.payout).toFixed(2) : '—'} /></div>
                    <button className='dtrader__buy' onClick={client?.is_logged_in ? buy : connectAccount} disabled={client?.is_logged_in ? (loading || !isBarrierValid()) : false}>{client?.is_logged_in ? ('RUN ' + labelFor(type, barrier).toUpperCase()) : 'CONNECT DERIV ACCOUNT'}</button>
                    {message && <div className='dtrader__message'>{message}</div>}
                    <small>Manual execution only. This cockpit never buys automatically.</small>
                </aside>
            </div>
        </div>
    );
});

function livePrice(ticks: Tick[], decimals: number) { const value = ticks.length ? ticks[ticks.length - 1].quote : null; return value == null ? '—' : value.toFixed(decimals); }

function LiveChartFallback({ ticks, decimals, state }: { ticks: Tick[]; decimals: number; state: string }) {
    const points = ticks.slice(-120);
    if (points.length < 2) return <div className='dt-chart-loading'>{state}</div>;
    const values = points.map(t => t.quote);
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const path = values.map((v, i) => `${(i / (values.length - 1)) * 100},${92 - ((v - min) / span) * 78}`).join(' ');
    return <div className='dt-chart-fallback'><div className='dt-fallback-title'><span>LIVE TICK PREVIEW</span><b>{values[values.length - 1].toFixed(decimals)}</b></div><svg viewBox='0 0 100 100' preserveAspectRatio='none' aria-label='Live tick preview'><polyline points={path} fill='none' vectorEffect='non-scaling-stroke' /></svg><small>{state}</small></div>;
}

function Metric({ l, v }: { l: string; v: string }) {
    return <div className='dtrader__metric'><small>{l}</small><b>{v}</b></div>;
}
