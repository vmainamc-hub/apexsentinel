import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import './riskmanagers-tools.scss';

type ContractType = 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITMATCH' | 'DIGITDIFF';

const MARKETS = [
    { symbol: 'R_10', label: 'Volatility 10' },
    { symbol: 'R_25', label: 'Volatility 25' },
    { symbol: 'R_50', label: 'Volatility 50' },
    { symbol: 'R_75', label: 'Volatility 75' },
    { symbol: 'R_100', label: 'Volatility 100' },
    { symbol: '1HZ10V', label: 'Volatility 10 (1s)' },
    { symbol: '1HZ25V', label: 'Volatility 25 (1s)' },
    { symbol: '1HZ50V', label: 'Volatility 50 (1s)' },
    { symbol: '1HZ75V', label: 'Volatility 75 (1s)' },
    { symbol: '1HZ100V', label: 'Volatility 100 (1s)' },
];

const DTrader = observer(() => {
    const [symbol, setSymbol] = useState('R_50');
    const [contractType, setContractType] = useState<ContractType>('DIGITEVEN');
    const [stake, setStake] = useState('1');
    const [barrier, setBarrier] = useState('4');
    const [quote, setQuote] = useState<number | null>(null);
    const [digits, setDigits] = useState<number[]>([]);
    const [proposal, setProposal] = useState<any>(null);
    const [status, setStatus] = useState('Connecting to Deriv…');
    const [lastContract, setLastContract] = useState<any>(null);

    const distribution = useMemo(() => {
        const counts = Array(10).fill(0);
        digits.forEach(d => counts[d]++);
        const total = digits.length || 1;
        return counts.map((count, digit) => ({ digit, count, pct: Number(((count / total) * 100).toFixed(1)) }));
    }, [digits]);

    useEffect(() => {
        let subscription: any;
        const connect = async () => {
            if (!api_base.api) {
                setStatus('Log in to Deriv to trade.');
                return;
            }
            try {
                setStatus('Live');
                const history = await (api_base.api as any).send({ ticks_history: symbol, count: 120, end: 'latest', style: 'ticks' });
                const initial = (history?.history?.prices || []).map((p: number) => Number(String(p).replace('.', '').slice(-1))).filter((d: number) => d >= 0 && d <= 9);
                setDigits(initial.slice(-120));
                setQuote(history?.history?.prices?.at?.(-1) ?? null);
                subscription = (api_base.api as any).subscribe({ ticks: symbol }).subscribe((data: any) => {
                    if (data?.tick?.quote === undefined) return;
                    const value = Number(data.tick.quote);
                    const last = Number(String(value).replace('.', '').slice(-1));
                    setQuote(value);
                    setDigits(prev => [...prev, last].slice(-120));
                });
            } catch (error) {
                setStatus(error instanceof Error ? error.message : 'Unable to load market data.');
            }
        };
        connect();
        return () => subscription?.unsubscribe?.();
    }, [symbol]);

    const getProposal = async () => {
        if (!api_base.api) return setStatus('Log in to Deriv first.');
        try {
            setStatus('Requesting proposal…');
            const response = await (api_base.api as any).send({
                proposal: 1,
                amount: Number(stake),
                basis: 'stake',
                contract_type: contractType,
                currency: 'USD',
                duration: 1,
                duration_unit: 't',
                symbol,
                ...(contractType === 'DIGITOVER' || contractType === 'DIGITUNDER' || contractType === 'DIGITMATCH' || contractType === 'DIGITDIFF'
                    ? { barrier: String(barrier) }
                    : {}),
            });
            setProposal(response?.proposal || null);
            setStatus(response?.proposal ? 'Proposal ready' : 'Proposal unavailable');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Proposal request failed.');
        }
    };

    const buy = async () => {
        if (!proposal?.id || !api_base.api) return setStatus('Request a proposal first.');
        try {
            const response = await (api_base.api as any).send({ buy: proposal.id, price: Number(proposal.ask_price) });
            setLastContract(response?.buy || response);
            setStatus(response?.buy?.contract_id ? `Bought contract ${response.buy.contract_id}` : 'Trade submitted');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Buy request failed.');
        }
    };

    const even = distribution.filter(d => d.digit % 2 === 0).reduce((s, d) => s + d.count, 0);
    const odd = digits.length - even;

    return (
        <div className='rm-tool'>
            <div className='rm-tool__header'>
                <div><h2>DTrader</h2><span>Live manual trading terminal</span></div>
                <span className={status === 'Live' || status.startsWith('Bought') ? 'rm-status rm-status--live' : 'rm-status'}>{status}</span>
            </div>
            <div className='rm-grid rm-grid--dtrader'>
                <section className='rm-card rm-card--market'>
                    <div className='rm-card__title'>Live market</div>
                    <select value={symbol} onChange={e => setSymbol(e.target.value)}>
                        {MARKETS.map(m => <option key={m.symbol} value={m.symbol}>{m.label} — {m.symbol}</option>)}
                    </select>
                    <div className='rm-quote'>{quote === null ? '—' : quote}</div>
                    <div className='rm-muted'>Last digit distribution · {digits.length} ticks</div>
                    <div className='rm-digit-grid'>
                        {distribution.map(d => <div key={d.digit} className='rm-digit'><strong>{d.digit}</strong><span>{d.pct}%</span></div>)}
                    </div>
                    <div className='rm-split'><span>EVEN {digits.length ? ((even / digits.length) * 100).toFixed(1) : '50.0'}%</span><span>ODD {digits.length ? ((odd / digits.length) * 100).toFixed(1) : '50.0'}%</span></div>
                </section>
                <section className='rm-card'>
                    <div className='rm-card__title'>Trade ticket</div>
                    <label>Contract<select value={contractType} onChange={e => setContractType(e.target.value as ContractType)}>
                        <option value='DIGITEVEN'>Even</option><option value='DIGITODD'>Odd</option>
                        <option value='DIGITOVER'>Over</option><option value='DIGITUNDER'>Under</option>
                        <option value='DIGITMATCH'>Matches</option><option value='DIGITDIFF'>Differs</option>
                    </select></label>
                    <label>Stake<input type='number' min='0.35' step='0.01' value={stake} onChange={e => setStake(e.target.value)} /></label>
                    {['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(contractType) && <label>Barrier<input value={barrier} onChange={e => setBarrier(e.target.value.replace(/[^0-9]/g, '').slice(0,1))} /></label>}
                    <button className='rm-button rm-button--secondary' onClick={getProposal}>Get proposal</button>
                    {proposal && <div className='rm-proposal'><span>Ask {proposal.ask_price}</span><span>Payout {proposal.payout}</span><span>Spot {proposal.spot}</span></div>}
                    <button className='rm-button rm-button--primary' disabled={!proposal} onClick={buy}>Buy contract</button>
                    {lastContract?.contract_id && <div className='rm-success'>Contract {lastContract.contract_id} submitted.</div>}
                </section>
            </div>
        </div>
    );
});

export default DTrader;
