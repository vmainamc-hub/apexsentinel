import { api_base } from "@/external/bot-skeleton";
import { derivBus } from "@/lib/deriv/tick-bus";
import { executionJournal } from "./execution-journal";
import { calculateStake, calculateSplitStake } from "./stake-calculator";
import { validateSignalStructure } from "./signal-adapter";
import type { ExecutionMode,ExecutionTrigger,ExecutorStatus,ExecutionSignal,RiskSettings,OpenContract,SignalQueueItem,AutoExecutionState,SessionState,GateEvaluationResult } from "./types";
import { DEFAULT_RISK_SETTINGS } from "./types";

export interface AccountSession { loginid:string; currency:string; balance:number; isVirtual:boolean; connected:boolean; }
const SETTINGS_KEY="sentinel.forge.settings.v1"; const MAX_QUEUE=50; const EXECUTION_TIMEOUT_MS=12000;

class SentinelForgeExecutor {
 private mode:ExecutionMode="PAPER"; private autoState:AutoExecutionState="OFF"; private risk:RiskSettings={...DEFAULT_RISK_SETTINGS};
 private account:AccountSession|null=null; private queue:SignalQueueItem[]=[]; private staged:ExecutionSignal|null=null;
 private open=new Map<string,OpenContract>(); private listeners=new Set<()=>void>(); private lastTickAt=0; private latestError:string|null=null; private pipelineStep="IDLE";
 private baseline:number|null=null; private tradesThisHour:number[]=[]; private executedIds=new Set<string>();
 private session:SessionState={startingBalance:null,accountStartBalance:null,currentAccountBalance:null,accountPnl:0,sessionProfit:0,sessionLoss:0,netPnl:0,tradesCount:0,wins:0,losses:0,winRate:0,consecutiveLosses:0,currentRecoveryStep:0,currentCalculatedStake:.35,isTargetProfitReached:false,isStopLossReached:false,isMaxConsecutiveLossesReached:false,cooldownUntil:0,autoState:"OFF",recoveryTotalLost:0,pendingRecovery:null};
 constructor(){this.load(); derivBus.onTick((s,t)=>{this.lastTickAt=t.t;});}
 private load(){if(typeof window==="undefined")return;try{const x=localStorage.getItem(SETTINGS_KEY);if(x)this.risk={...DEFAULT_RISK_SETTINGS,...JSON.parse(x)}}catch{}}
 private save(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(this.risk))}catch{}}
 subscribe(f:()=>void){this.listeners.add(f);return()=>{this.listeners.delete(f)}} private notify(){this.listeners.forEach(f=>f())}
 getMode(){return this.mode} setMode(m:ExecutionMode){this.mode=m;this.notify()} getAutoState(){return this.autoState} isAutoArmed(){return this.autoState==="ON"}
 setAutoState(s:AutoExecutionState,reason?:string){this.autoState=s;this.session.autoState=s;this.session.pauseReason=reason;if(s==="ON")void this.processQueue();this.notify()}
 pauseAuto(r="Manual pause"){this.setAutoState("PAUSED",r)} resumeAuto(){this.setAutoState("ON")} stopAutoTrading(){this.setAutoState("OFF","Stopped");executionJournal.logEvent({type:"EMERGENCY_STOP",signalId:"SYS",message:"Stopped: new auto executions disabled."})}
 getRiskSettings(){return {...this.risk}} updateRiskSettings(u:Partial<RiskSettings>){this.risk={...this.risk,...u};this.save();this.notify()}
 setAccount(a:AccountSession|null){const accountChanged=this.account?.loginid!==a?.loginid;this.account=a;if(a){if(this.baseline===null||accountChanged){this.baseline=a.balance;this.session.startingBalance=a.balance;this.session.accountStartBalance=a.balance}this.session.currentAccountBalance=a.balance;this.session.accountPnl=Number((a.balance-(this.baseline??a.balance)).toFixed(2));}else{this.baseline=null;this.session.currentAccountBalance=null;this.session.accountPnl=0}this.notify()}
 resetSessionMetrics(){if(this.account)this.baseline=this.account.balance;this.session={...this.session,startingBalance:this.baseline,accountStartBalance:this.baseline,currentAccountBalance:this.account?.balance??null,accountPnl:0,sessionProfit:0,sessionLoss:0,netPnl:0,tradesCount:0,wins:0,losses:0,winRate:0,consecutiveLosses:0,currentRecoveryStep:0,currentCalculatedStake:this.risk.baseStake,isTargetProfitReached:false,isStopLossReached:false,isMaxConsecutiveLossesReached:false,cooldownUntil:0,recoveryTotalLost:0,pendingRecovery:null};this.executedIds.clear();this.notify()}
 getSessionState(){return {...this.session}} getAccount(){return this.account}
 getSignalQueue(){return [...this.queue]} getStagedSignal(){return this.staged} stageSignal(s:ExecutionSignal|null){this.staged=s; if(s){const q=this.queue.find(x=>x.signal.id===s.id);if(q&&q.state==="RECEIVED")q.state="LOADED";executionJournal.logEvent({type:"SIGNAL_LOADED",signalId:s.id,message:"Signal loaded into Forge."})}this.notify()}
 getOpenContracts(){return [...this.open.values()]} getPipelineStep(){return this.pipelineStep} getLatestError(){return this.latestError}
 private directionOf(s:ExecutionSignal):string{return String(s.direction||"").toUpperCase()}
 private recoveryDigitFor(dir:string):number{return dir==="OVER"?this.risk.recoveryDigitOver:this.risk.recoveryDigitUnder}
 private defaultEntryDigitFor(dir:string):number{return dir==="OVER"?this.risk.defaultEntryDigitOver:this.risk.defaultEntryDigitUnder}
 getEffectiveNextStake(){
  const inRecovery=this.risk.martingaleEnabled&&(this.session.recoveryTotalLost>0||this.session.currentRecoveryStep>0);
  if(!inRecovery){this.session.currentCalculatedStake=Math.max(.35,this.risk.baseStake);return this.session.currentCalculatedStake}
  const balance=this.mode==="LIVE"?this.account?.balance:10000;
  const r=this.risk.martingaleMode==="SPLIT"
   ?calculateSplitStake({totalLost:this.session.recoveryTotalLost,payoutPercent:this.risk.payoutPercent,split:this.risk.martingaleSplit,maxStake:this.risk.maxStake,maxRecoveryStake:this.risk.maxRecoveryStake,accountBalance:balance})
   :calculateStake({baseStake:this.risk.baseStake,martingaleEnabled:true,martingaleMultiplier:this.risk.martingaleMultiplier,recoveryStep:this.session.currentRecoveryStep,maxStake:this.risk.maxStake,maxRecoveryStake:this.risk.maxRecoveryStake,accountBalance:balance});
  this.session.currentCalculatedStake=r.stake;return r.stake;
 }
 getStatus():ExecutorStatus{if(this.mode==="LIVE"&&!this.account?.connected)return"ACCOUNT_DISCONNECTED";if(this.pipelineStep==="PROPOSAL"||this.pipelineStep==="BUYING")return"EXECUTING";if(this.autoState==="PAUSED")return"PAUSED";if(this.autoState==="ON")return"ARMED";if(this.lastTickAt&&Date.now()-this.lastTickAt>7000)return"FEED_STALE";return"AUTO_OFF"}
 receiveSignal(signal:ExecutionSignal){
  const v=validateSignalStructure(signal);if(!v.valid){this.latestError=v.reason||"Invalid signal";return null}
  if(this.risk.duplicateProtection&&this.queue.some(q=>q.signal.id===signal.id))return this.queue.find(q=>q.signal.id===signal.id)!;
  let effective=signal;
  if(this.session.pendingRecovery){
   const dir=this.directionOf(signal);
   if(dir===this.session.pendingRecovery.direction){
    const digit=this.session.pendingRecovery.digit;
    effective={...signal,barrier:digit,contractLabel:`${dir==="OVER"?"Over":"Under"} ${digit}`,metadata:{...signal.metadata,recoveryApplied:true}};
   }
   this.session.pendingRecovery=null;
  }
  const item:SignalQueueItem={signal:effective,state:"RECEIVED",receivedAt:Date.now()};
  this.queue=[item,...this.queue].slice(0,MAX_QUEUE);
  executionJournal.logEvent({type:"SIGNAL_RECEIVED",signalId:effective.id,message:"Sentinel signal received by Forge.",details:{sentinelStatus:effective.sentinelStatus}});
  this.notify();
  if(this.autoState==="ON"&&this.risk.autoSignalPolicy==="EXECUTE_ALL")void this.awaitEntry(item);
  return item;
 }
 private async awaitEntry(item:SignalQueueItem){
  const s=item.signal;if(Date.now()>s.expiresAt){item.state="EXPIRED";return}
  if(this.risk.entryMode==="INSTANT"){void this.executeSignal(s,"AUTO");return}
  const digit=s.entryDigit??this.defaultEntryDigitFor(this.directionOf(s));
  item.state="WAITING";this.notify();
  const market=s.market;
  const unsub=derivBus.onTick((sym,t)=>{if(sym!==market)return;const pip=derivBus.getPipSize(sym);const d=Math.abs(Math.round(t.price*Math.pow(10,pip)))%10;if(d!==digit)return;unsub();if(Date.now()>s.expiresAt){item.state="EXPIRED";this.notify();return}void this.executeSignal(s,"AUTO")});
  setTimeout(()=>{unsub();if(item.state==="WAITING"){item.state="EXPIRED";this.notify()}},Math.max(1000,s.expiresAt-Date.now()));
 }
 private async processQueue(){for(const q of this.queue.filter(x=>x.state==="RECEIVED"||x.state==="LOADED"))await this.awaitEntry(q)}
 private gates(s:ExecutionSignal,trigger:ExecutionTrigger,stake:number):GateEvaluationResult{const age=Date.now()-s.createdAt;if(age>Math.max(30,this.risk.maxSignalAgeSeconds)*1000)return{ok:false,reason:"Signal expired"};if(trigger==="AUTO"&&this.autoState!=="ON")return{ok:false,reason:"Auto execution is OFF"};if(trigger==="AUTO"&&this.risk.autoSignalPolicy==="SELECTED_TYPES"&&!this.risk.allowedContractTypes.includes(s.contractType))return{ok:false,reason:"Contract type excluded by execution policy"};if(this.mode==="LIVE"&&(!this.account?.connected||!this.account.loginid))return{ok:false,reason:"Account disconnected"};if(this.mode==="LIVE"&&(this.account?.balance??0)<stake)return{ok:false,reason:"Insufficient account balance"};if(this.open.size>=this.risk.maxOpenContracts)return{ok:false,reason:"Maximum open contracts reached"};if(this.risk.targetProfit!==null&&this.session.accountPnl>=this.risk.targetProfit)return{ok:false,reason:"Target profit reached"};if(this.risk.maxDailyProfit!==null&&this.session.sessionProfit>=this.risk.maxDailyProfit)return{ok:false,reason:"Daily profit limit reached"};if(this.risk.stopLoss!==null&&this.session.accountPnl<=-this.risk.stopLoss)return{ok:false,reason:"Stop loss reached"};if(this.risk.maxConsecutiveLosses!==null&&this.session.consecutiveLosses>=this.risk.maxConsecutiveLosses)return{ok:false,reason:"Maximum consecutive losses reached"};if(this.risk.maxTradesPerSession!==null&&this.session.tradesCount>=this.risk.maxTradesPerSession)return{ok:false,reason:"Session trade limit reached"};if(stake<.35||stake>this.risk.maxStake)return{ok:false,reason:"Stake outside configured bounds"};return{ok:true}}
 async executeSignal(s:ExecutionSignal,trigger:ExecutionTrigger="MANUAL",customStake?:number){
  const stake=customStake??this.getEffectiveNextStake();
  if(this.executedIds.has(s.id)&&this.risk.duplicateProtection)return{ok:false,error:"Duplicate signal"};
  const gate=this.gates(s,trigger,stake);
  if(!gate.ok){executionJournal.recordRejection({signalId:s.id,account:this.account?.loginid??"N/A",market:s.market,contract:s.contractType,barrier:s.barrier,duration:s.duration,stake,confidence:s.confidence,confluence:s.confluence,reason:gate.reason||"Execution blocked",mode:this.mode+"_"+trigger as any});return{ok:false,error:gate.reason}}
  this.executedIds.add(s.id);this.pipelineStep="PROPOSAL";this.notify();
  const inRecovery=this.risk.martingaleEnabled&&this.session.recoveryTotalLost>0;
  const recoveryDigit=inRecovery?this.recoveryDigitFor(this.directionOf(s)):null;
  if(this.mode==="PAPER"){await new Promise(r=>setTimeout(r,50));this.session.tradesCount++;this.pipelineStep="IDLE";this.notify();return{ok:true,contractId:"PAPER-"+Date.now()}}
  try{
   if(!api_base.api)throw new Error("Deriv connection unavailable");
   const proposal:any=await api_base.api.send({proposal:1,amount:stake,basis:"stake",contract_type:s.contractType,currency:this.account?.currency||"USD",duration:s.duration,duration_unit:s.durationUnit,barrier:s.barrier,underlying_symbol:s.market});
   const pid=proposal?.proposal?.id;if(!pid)throw new Error(proposal?.error?.message||"Proposal unavailable");
   this.pipelineStep="BUYING";
   const buy:any=await api_base.api.send({buy:pid,price:stake});
   const cid=String(buy?.buy?.contract_id||"");if(!cid)throw new Error(buy?.error?.message||"Buy failed");
   const oc:OpenContract={contractId:cid,signalId:s.id,market:s.market,marketName:s.marketName,contractType:s.contractType,contractLabel:s.contractLabel,barrier:s.barrier,durationTicks:s.duration,buyPrice:Number(buy.buy.buy_price??stake),potentialPayout:Number(buy.buy.payout??0),currentProfit:0,status:"open",buyTime:Date.now(),isSellable:true,mode:this.mode,accountLoginid:this.account!.loginid,baseSignalId:s.metadata?.baseSignalId||s.id,runIndex:1,runsTotal:1,entryDigit:s.entryDigit,recoveryDigit};
   this.open.set(cid,oc);this.session.tradesCount++;
   executionJournal.recordTrade({signalId:s.id,account:this.account!.loginid,market:s.market,contract:s.contractType,barrier:s.barrier,duration:s.duration,stake,martingaleStep:this.session.currentRecoveryStep,baseStake:this.risk.baseStake,multiplier:this.risk.martingaleMode==="SPLIT"?this.risk.martingaleSplit:this.risk.martingaleMultiplier,targetProfit:this.risk.targetProfit,stopLoss:this.risk.stopLoss,buyPrice:oc.buyPrice,payout:oc.potentialPayout,contractId:cid,status:"EXECUTED",mode:`${this.mode}_${trigger}` as "LIVE_AUTO"|"LIVE_MANUAL"|"PAPER_AUTO"|"PAPER_MANUAL",trigger});
   this.listenContract(cid,oc);
   executionJournal.logEvent({type:"BUY_CONFIRMED",signalId:s.id,message:"Contract purchased.",details:{contractId:cid,stake,barrier:s.barrier}});
   this.pipelineStep="IDLE";this.notify();return{ok:true,contractId:cid}
  }catch(e){this.latestError=e instanceof Error?e.message:String(e);this.pipelineStep="IDLE";this.notify();return{ok:false,error:this.latestError}}
 }
 private listenContract(cid:string,oc:OpenContract){if(!api_base.api)return;const send:any=(api_base.api as any).send.bind(api_base.api);const sub:any=send({proposal_open_contract:1,contract_id:cid,subscribe:1});if(sub?.then)void sub.then((x:any)=>this.handleContract(x?.subscription?.data||x));const un=api_base.api.onMessage().subscribe((m:any)=>{const x=m?.data||m;if(x?.msg_type!=="proposal_open_contract"||String(x?.proposal_open_contract?.contract_id)!==cid)return;this.handleContract(x);if(x.proposal_open_contract?.is_sold||x.proposal_open_contract?.status==="sold")un.unsubscribe?.()})}
 private handleContract(m:any){
  const p=m?.proposal_open_contract;if(!p)return;
  const cid=String(p.contract_id);const oc=this.open.get(cid);if(!oc)return;
  oc.currentProfit=Number(p.profit??0);oc.currentSpot=Number(p.current_spot??p.current_spot_display??0)||oc.currentSpot;oc.entrySpot=Number(p.entry_spot??0)||oc.entrySpot;oc.exitSpot=Number(p.exit_spot??0)||oc.exitSpot;
  const sold=Boolean(p.is_sold||p.status==="sold");
  if(!sold){this.notify();return}
  const pnl=Number(p.profit??0);const won=pnl>=0;
  oc.status=won?"won":"lost";oc.settleTime=Date.now();
  this.session.netPnl+=pnl;
  if(won)this.session.sessionProfit+=pnl;else this.session.sessionLoss+=Math.abs(pnl);
  this.session.accountPnl=Number(((this.session.currentAccountBalance??this.baseline??0)-(this.baseline??this.session.startingBalance??0)).toFixed(2));
  if(won){
   this.session.wins++;this.session.consecutiveLosses=0;
   if(this.risk.resetAfterWin){this.session.currentRecoveryStep=0;this.session.recoveryTotalLost=0;this.session.pendingRecovery=null}
  }else{
   this.session.losses++;this.session.consecutiveLosses++;
   if(this.risk.martingaleEnabled){this.session.currentRecoveryStep=Math.min(this.session.currentRecoveryStep+1,this.risk.maxRecoverySteps);this.session.recoveryTotalLost+=oc.buyPrice}
  }
  this.session.winRate=this.session.tradesCount?this.session.wins/this.session.tradesCount*100:0;
  executionJournal.updateTradeOutcome(cid,{result:won?"WIN":"LOSS",pnl,settlementSpot:oc.exitSpot,durationMs:Date.now()-oc.buyTime});
  this.open.delete(cid);this.notify();
  this.afterSettlement(oc,won);
 }
 private afterSettlement(oc:OpenContract,won:boolean){
  if(this.autoState!=="ON")return;
  if(this.risk.targetProfit!==null&&this.session.accountPnl>=this.risk.targetProfit){this.pauseAuto("Target profit reached");return}
  if(this.risk.stopLoss!==null&&this.session.accountPnl<=-this.risk.stopLoss){this.pauseAuto("Stop loss reached");return}
  if(this.risk.maxConsecutiveLosses!==null&&this.session.consecutiveLosses>=this.risk.maxConsecutiveLosses){this.pauseAuto("Max consecutive losses reached");return}
  const base=this.queue.find(q=>q.signal.id===oc.baseSignalId)?.signal;if(!base)return;
  const dir=this.directionOf(base);
  if(this.risk.runMode==="CONTINUOUS"){
   this.receiveSignal(this.buildContinuationSignal(base,oc,won,dir));
   return;
  }
  if(won)return;
  if(this.risk.recoveryTiming==="INSTANT"){
   this.receiveSignal(this.buildContinuationSignal(base,oc,won,dir));
  }else{
   this.session.pendingRecovery={direction:dir,stake:this.getEffectiveNextStake(),digit:this.recoveryDigitFor(dir)};
   this.notify();
  }
 }
 private buildContinuationSignal(base:ExecutionSignal,oc:OpenContract,won:boolean,dir:string):ExecutionSignal{
  const digit=won?base.barrier:this.recoveryDigitFor(dir);
  const label=won?base.contractLabel:`${dir==="OVER"?"Over":"Under"} ${digit}`;
  return {...base,id:`${oc.baseSignalId||base.id}:cont-${Date.now()}`,createdAt:Date.now(),expiresAt:Date.now()+Math.max(5000,this.risk.maxSignalAgeSeconds*1000),barrier:digit,contractLabel:label,metadata:{...base.metadata,baseSignalId:oc.baseSignalId||base.id}};
 }
 sellContract(id:string){if(!api_base.api)return Promise.resolve({ok:false,error:"No Deriv connection"});const send:any=(api_base.api as any).send.bind(api_base.api);return Promise.resolve(send({sell:id,price:0})).then((r:any)=>r?.error?{ok:false,error:r.error.message}:{ok:true})}
 clearSignalQueue(){this.queue=[];this.staged=null;this.notify()}
}
function signalFromContract(oc:OpenContract):ExecutionSignal{return{id:oc.signalId,createdAt:oc.buyTime,expiresAt:Date.now()+120000,market:oc.market,marketName:oc.marketName,contractType:oc.contractType,barrier:oc.barrier,contractLabel:oc.contractLabel,duration:oc.durationTicks,durationUnit:"t",direction:oc.contractType==="DIGITOVER"?"OVER":"UNDER",entryDigit:oc.entryDigit,confidence:0,confluence:0,score:0,sentinelStatus:"EXECUTING",metadata:{baseSignalId:oc.baseSignalId}}}

export const sentinelExecutor=new SentinelForgeExecutor();
