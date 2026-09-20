import {useState} from "react";
import {useSentinelForge} from "@/hooks/useSentinelForge";
import {CONNECTION_STATUS} from "@/external/bot-skeleton/services/api/observables/connection-status-stream";
import "./sentinel-forge.scss";

const money=(n:number|null|undefined)=>n==null?"—":Number(n).toFixed(2);
const time=(n:number)=>new Date(n).toLocaleTimeString();

export default function SentinelForge(){
 const {apex,api,executor,risk,session,queue,openContracts,journal,executeManual,updateRisk}=useSentinelForge();
 const [stake,setStake]=useState(risk.baseStake);
 const signal=executor.getStagedSignal();
 const connected=api.isAuthorized&&api.connectionStatus===CONNECTION_STATUS.OPENED;
 const trades=journal.filter(r=>r.status==="EXECUTED").slice(0,80);
 const setNum=(key:any,min:number,max?:number)=>(e:any)=>{let v=Number(e.target.value);if(!Number.isFinite(v))v=min;v=Math.max(min,v);if(max!==undefined)v=Math.min(max,v);updateRisk({[key]:v} as any)};
 return <div className="sentinel-forge">
  <div className="forge-head"><div><div className="forge-kicker">SENTINEL FORGE</div><h1>Execution workspace</h1><p>Sentinel remains the authoritative signal engine. Forge only controls execution.</p></div><div className="forge-health"><span className={connected?"dot live":"dot"}></span>{connected?"ACCOUNT CONNECTED":"ACCOUNT OFFLINE"}<b>{api.activeLoginid||"—"}</b><span className="market-health">{apex.online}/{apex.total} MARKETS LIVE</span></div></div>
  <div className="forge-grid">
   <section className="forge-card signal"><div className="card-title">CURRENT SENTINEL SIGNAL</div>{signal?<><div className="signal-main">{signal.contractLabel}<span>{signal.market}</span></div><div className="metrics"><div><small>ENTRY</small><b>{signal.entryDigit??"—"}</b></div><div><small>STATUS</small><b>{signal.sentinelStatus}</b></div><div><small>SCORE</small><b>{signal.score}</b></div><div><small>MODE</small><b>{risk.signalExecutionMode}</b></div></div><button className="forge-primary" disabled={!connected&&executor.getMode()==="LIVE"} onClick={()=>void executeManual(signal,stake)}>RUN SIGNAL</button></>:<div className="empty">Waiting for a surfaced Sentinel signal…<br/><span>{apex.status.toUpperCase()} · {apex.online}/{apex.total} markets live</span></div>}</section>

   <section className="forge-card"><div className="card-title">EXECUTION CONTROLS</div>
    <label>ACCOUNT MODE<select value={executor.getMode()} onChange={e=>executor.setMode(e.target.value as any)}><option value="PAPER">PAPER</option><option value="LIVE">LIVE</option></select></label>
    <label>BASE STAKE<input type="number" min=".35" step=".01" value={stake} onChange={e=>{const v=Math.max(.35,Number(e.target.value));setStake(v);updateRisk({baseStake:v,stake:v})}}/></label>
    <label>ENTRY EXECUTION<select value={risk.entryExecutionMode} onChange={e=>updateRisk({entryExecutionMode:e.target.value as any})}><option value="INSTANT">INSTANT — EXECUTE SIGNAL</option><option value="WAIT_FOR_ENTRY">WAIT — EXECUTE ON ENTRY DIGIT</option></select></label>
    <label>SIGNAL EXECUTION<select value={risk.signalExecutionMode} onChange={e=>updateRisk({signalExecutionMode:e.target.value as any})}><option value="ONE_PER_SIGNAL">ONE CONTRACT / SIGNAL</option><option value="CONTINUOUS">CONTINUOUS — RUN UNTIL STOP</option></select></label>
    <label>RECOVERY TIMING<select value={risk.recoveryExecutionMode} onChange={e=>updateRisk({recoveryExecutionMode:e.target.value as any})}><option value="NEXT_SIGNAL">WAIT FOR NEXT SIGNAL</option><option value="INSTANT">INSTANT AFTER LOSS</option></select></label>
    <div className="forge-two"><label>OVER RECOVERY<input type="number" min="0" max="9" value={risk.overRecoveryDigit} onChange={setNum("overRecoveryDigit",0,9)}/></label><label>UNDER RECOVERY<input type="number" min="0" max="9" value={risk.underRecoveryDigit} onChange={setNum("underRecoveryDigit",0,9)}/></label></div>
    <div className="forge-two"><label>OVER DEFAULT ENTRY<input type="number" min="0" max="9" value={risk.defaultOverEntryDigit} onChange={setNum("defaultOverEntryDigit",0,9)}/></label><label>UNDER DEFAULT ENTRY<input type="number" min="0" max="9" value={risk.defaultUnderEntryDigit} onChange={setNum("defaultUnderEntryDigit",0,9)}/></label></div>
    <div className="toggle-row"><span>AUTO EXECUTION</span><button className={executor.isAutoArmed()?"toggle on":"toggle"} onClick={()=>executor.setAutoState(executor.isAutoArmed()?"OFF":"ON")}>{executor.isAutoArmed()?"ON":"OFF"}</button></div><button className="danger" onClick={()=>executor.stopAutoTrading()}>STOP</button>
   </section>

   <section className="forge-card"><div className="card-title">SPLIT MARTINGALE</div>
    <div className="toggle-row"><span>ENABLE MARTINGALE</span><button className={risk.martingaleEnabled?"toggle on":"toggle"} onClick={()=>updateRisk({martingaleEnabled:!risk.martingaleEnabled})}>{risk.martingaleEnabled?"ON":"OFF"}</button></div>
    <label>LOSS RECOVERY SPLIT<input type="number" min="1" max="10" step="1" value={risk.martingaleSplit} onChange={setNum("martingaleSplit",1,10)}/></label>
    <label>PAYOUT % USED<input type="number" min="1" max="1000" value={risk.payoutPercent} onChange={setNum("payoutPercent",1,1000)}/></label>
    <label>MARTINGALE MULTIPLIER<input type="number" min=".01" max="10" step=".01" value={risk.martingaleMultiplier} onChange={setNum("martingaleMultiplier",.01,10)}/></label>
    <label>MAX RECOVERY STAKE<input type="number" min=".35" step=".01" value={risk.maxRecoveryStake} onChange={setNum("maxRecoveryStake",.35)}/></label>
    <div className="risk-formula">The uploaded bot uses accumulated loss ÷ payout rate ÷ split. Forge keeps that split structure and applies the configured stake limits.</div>
    <div className="risk-line"><span>CURRENT STEP</span><b>{session.currentRecoveryStep}</b></div><div className="risk-line"><span>NEXT STAKE</span><b>{money(session.currentCalculatedStake)}</b></div>
   </section>

   <section className="forge-card"><div className="card-title">TARGET / STOP</div>
    <label>TARGET PROFIT<input type="number" min="0" step=".01" value={risk.targetProfit??""} onChange={e=>updateRisk({targetProfit:e.target.value===""?null:Number(e.target.value)})}/></label>
    <label>STOP LOSS<input type="number" min="0" step=".01" value={risk.stopLoss??""} onChange={e=>updateRisk({stopLoss:e.target.value===""?null:Number(e.target.value)})}/></label>
    <div className="risk-line"><span>SESSION P/L</span><b>{session.netPnl>=0?"+":""}{money(session.netPnl)}</b></div><div className="risk-line"><span>W / L</span><b>{session.wins} / {session.losses}</b></div><div className="risk-line"><span>WIN RATE</span><b>{session.winRate.toFixed(1)}%</b></div><button className="secondary" onClick={()=>executor.resetSessionMetrics()}>RESET SESSION</button>
   </section>

   <section className="forge-card wide"><div className="card-title">OPEN CONTRACTS</div>{openContracts.length?<div className="contract-list">{openContracts.map(c=><div key={c.contractId}><b>{c.contractLabel}</b><span>{c.market} · {c.contractId}</span><span>Entry {c.entryDigit??"—"} · Stake {money(c.buyPrice)}</span><strong className={c.currentProfit>=0?"profit":"loss"}>{c.currentProfit>=0?"+":""}{money(c.currentProfit)}</strong></div>)}</div>:<div className="empty small">No open contracts.</div>}</section>

   <section className="forge-card wide transactions"><div className="card-title">TRANSACTIONS BOARD</div><div className="table-wrap"><table><thead><tr><th>TIME</th><th>MARKET</th><th>CONTRACT</th><th>ENTRY</th><th>STAKE</th><th>RECOVERY</th><th>RESULT</th><th>EXIT DIGIT</th><th>P/L</th><th>CONTRACT ID</th></tr></thead><tbody>{trades.length?trades.map(r=><tr key={r.id}><td>{time(r.timestamp)}</td><td>{r.market}</td><td>{r.contract} {r.barrier}</td><td>{r.entryDigit??"—"}</td><td>{money(r.stake)}</td><td>{r.martingaleStep}</td><td><b className={r.result==="WIN"?"win":"loss"}>{r.result||"OPEN"}</b></td><td>{r.exitDigit??"—"}</td><td className={(r.pnl??0)>=0?"profit":"loss"}>{(r.pnl??0)>=0?"+":""}{money(r.pnl)}</td><td>{r.contractId}</td></tr>):<tr><td colSpan={10} className="empty-cell">No completed executions yet.</td></tr>}</tbody></table></div></section>

   <section className="forge-card wide"><div className="card-title">EXECUTION PIPELINE</div><div className="execution-state"><b>{executor.getStatus()}</b><span>{executor.getPipelineStep()}</span><span>Open contracts: {openContracts.length}</span><span>Queue: {queue.length}</span><span>{apex.online}/{apex.total} markets live</span></div>{executor.getLatestError()&&<div className="forge-error">{executor.getLatestError()}</div>}</section>
  </div>
 </div>
}
