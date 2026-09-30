import { useMemo, useState } from 'react';
import './riskmanagers-tools.scss';

const Calculator = () => {
    const [balance, setBalance] = useState('100');
    const [stake, setStake] = useState('1');
    const [multiplier, setMultiplier] = useState('2');
    const [steps, setSteps] = useState('5');
    const [target, setTarget] = useState('10');

    const rows = useMemo(() => {
        const first = Math.max(0, Number(stake) || 0);
        const factor = Math.max(1, Number(multiplier) || 1);
        const count = Math.max(1, Math.min(12, Number(steps) || 1));
        let total = 0;
        return Array.from({ length: count }, (_, i) => {
            const amount = first * factor ** i;
            total += amount;
            return { step: i + 1, amount, total };
        });
    }, [stake, multiplier, steps]);

    const maxDrawdown = rows.at(-1)?.total || 0;
    const targetAmount = Number(balance || 0) * (Number(target || 0) / 100);

    return <div className='rm-tool'>
        <div className='rm-tool__header'><div><h2>Calculator</h2><span>Stake progression, recovery exposure and target planning</span></div></div>
        <div className='rm-grid'>
            <section className='rm-card'>
                <div className='rm-card__title'>Inputs</div>
                {[
                    ['Balance', balance, setBalance], ['Base stake', stake, setStake], ['Multiplier', multiplier, setMultiplier],
                    ['Recovery steps', steps, setSteps], ['Target profit %', target, setTarget],
                ].map(([label,value,setter]: any) => <label key={label}>{label}<input type='number' min='0' value={value} onChange={e => setter(e.target.value)} /></label>)}
                <div className='rm-metrics'><div><strong>{targetAmount.toFixed(2)}</strong><span>Target amount</span></div><div><strong>{maxDrawdown.toFixed(2)}</strong><span>Max planned stake exposure</span></div></div>
            </section>
            <section className='rm-card'>
                <div className='rm-card__title'>Recovery ladder</div>
                <table className='rm-table'><thead><tr><th>Step</th><th>Stake</th><th>Cumulative</th></tr></thead><tbody>{rows.map(r => <tr key={r.step}><td>{r.step}</td><td>{r.amount.toFixed(2)}</td><td>{r.total.toFixed(2)}</td></tr>)}</tbody></table>
                <div className='rm-warning'>A martingale ladder increases exposure after losses. The calculation is arithmetic planning, not a guarantee of recovery.</div>
            </section>
        </div>
    </div>;
};

export default Calculator;
