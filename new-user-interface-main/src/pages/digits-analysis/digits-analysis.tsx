import { useEffect, useMemo, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { lastDigit } from '@/utils/last-digit';
import '../riskmanagers-tools.scss';

const MARKETS = ['R_10','R_25','R_50','R_75','R_100','1HZ10V','1HZ25V','1HZ50V','1HZ75V','1HZ100V'];

const DigitsAnalysis = () => {
    const [symbol, setSymbol] = useState('R_50');
    const [digits, setDigits] = useState<number[]>([]);
    const [status, setStatus] = useState('Loading live digits…');

    useEffect(() => {
        let cancelled = false;
        let sub: any;
        let retry: ReturnType<typeof setTimeout> | undefined;
        const run = async () => {
            if (!api_base.api) {
                setStatus('Connect to Deriv to load live digits.');
                retry = setTimeout(run, 1000);
                return;
            }
            try {
                const history = await (api_base.api as any).send({ ticks_history: symbol, count: 500, end: 'latest', style: 'ticks' });
                if (cancelled) return;
                const pip = Number(history?.pip_size);
                setDigits((history?.history?.prices || []).map((p: number) => lastDigit(p, pip)).filter((d: number) => d >= 0 && d <= 9));
                sub = (api_base.api as any).subscribe({ ticks: symbol }).subscribe((data: any) => {
                    if (data?.tick?.quote === undefined) return;
                    const d = lastDigit(data.tick.quote, Number(data.tick.pip_size ?? pip));
                    if (d >= 0 && d <= 9) setDigits(prev => [...prev, d].slice(-500));
                });
                if (cancelled) sub?.unsubscribe?.();
                else setStatus('Live');
            } catch (e) { if (!cancelled) setStatus(e instanceof Error ? e.message : 'Unable to load digit history.'); }
        };
        setDigits([]);
        run();
        return () => { cancelled = true; if (retry) clearTimeout(retry); sub?.unsubscribe?.(); };
    }, [symbol]);

    const counts = useMemo(() => Array.from({length:10}, (_, d) => digits.filter(x => x === d).length), [digits]);
    const total = digits.length || 1;
    const even = digits.filter(d => d % 2 === 0).length;
    const odd = digits.length - even;
    const hottest = counts.indexOf(Math.max(...counts));
    const coldest = counts.indexOf(Math.min(...counts));

    return <div className='rm-tool'>
        <div className='rm-tool__header'><div><h2>Digits Analysis</h2><span>500-tick live digit distribution and parity analysis</span></div><span className={status === 'Live' ? 'rm-status rm-status--live' : 'rm-status'}>{status}</span></div>
        <div className='rm-card'>
            <select value={symbol} onChange={e => setSymbol(e.target.value)}>{MARKETS.map(m => <option key={m}>{m}</option>)}</select>
            <div className='rm-analysis-summary'><div><strong>{digits.length}</strong><span>Ticks</span></div><div><strong>{hottest}</strong><span>Hottest digit</span></div><div><strong>{coldest}</strong><span>Coldest digit</span></div><div><strong>{((even/total)*100).toFixed(1)}%</strong><span>Even</span></div><div><strong>{((odd/total)*100).toFixed(1)}%</strong><span>Odd</span></div></div>
            <div className='rm-bars'>{counts.map((count,d) => <div className='rm-bar' key={d}><span>{d}</span><div><i style={{width:`${Math.max(2,(count/total)*100)}%`}} /></div><strong>{((count/total)*100).toFixed(1)}%</strong></div>)}</div>
            <div className='rm-last-digits'>{digits.slice(-30).map((d,i)=><span key={i}>{d}</span>)}</div>
        </div>
    </div>;
};

export default DigitsAnalysis;
