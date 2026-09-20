import {useCallback,useEffect,useState} from "react";
import {useApexSentinel} from "@/hooks/useApexSentinel";
import {api_base} from "@/external/bot-skeleton";
import {useApiBase} from "@/hooks/useApiBase";
import {CONNECTION_STATUS} from "@/external/bot-skeleton/services/api/observables/connection-status-stream";
import {buildExecutionSignal} from "@/lib/executor/signal-adapter";
import {sentinelExecutor} from "@/lib/executor/engine";
import {executionJournal} from "@/lib/executor/execution-journal";
import type {ExecutionMode,RiskSettings} from "@/lib/executor/types";

export function useSentinelForge(){
 const apex=useApexSentinel(); const api=useApiBase(); const [,refresh]=useState(0);
 useEffect(()=>sentinelExecutor.subscribe(()=>refresh(x=>x+1)),[]);
 useEffect(()=>executionJournal.subscribe(()=>refresh(x=>x+1)),[]);
 useEffect(()=>{const a=api.authData;if(!a?.loginid){sentinelExecutor.setAccount(null);return}sentinelExecutor.setAccount({loginid:a.loginid,currency:a.currency||"USD",balance:Number(a.balance??0),isVirtual:Boolean(a.is_virtual),connected:api.connectionStatus===CONNECTION_STATUS.OPENED&&api.isAuthorized});},[api.authData,api.connectionStatus,api.isAuthorized]);
 useEffect(()=>{const ws=api_base?.api;if(!ws)return;const sub=ws.onMessage().subscribe((msg:any)=>{const m=msg?.data||msg;if(m?.msg_type==="balance"&&m?.balance!==undefined){const current=sentinelExecutor.getAccount();if(current)sentinelExecutor.setAccount({...current,balance:Number(m.balance),connected:api.isAuthorized&&api.connectionStatus===CONNECTION_STATUS.OPENED});}});return()=>sub?.unsubscribe?.()},[api.isAuthorized,api.connectionStatus]);
 useEffect(()=>{const id=apex.surfacedSignalId;const opp=apex.surfacedOpportunity;if(!id||!opp?.symbol||!opp.contract)return;const signal=buildExecutionSignal(opp);signal.id=`SENTINEL-${id}`;const settings=sentinelExecutor.getRiskSettings();signal.metadata={...signal.metadata,baseSignalId:signal.id};sentinelExecutor.receiveSignal(signal);sentinelExecutor.stageSignal(signal)},[apex.surfacedSignalId,apex.surfacedOpportunity]);
 const executeManual=useCallback((s:any,stake?:number)=>sentinelExecutor.executeSignal(s,"MANUAL",stake),[]);
 const updateRisk=useCallback((u:Partial<RiskSettings>)=>sentinelExecutor.updateRiskSettings(u),[]);
 return {apex,api,executor:sentinelExecutor,risk:sentinelExecutor.getRiskSettings(),session:sentinelExecutor.getSessionState(),queue:sentinelExecutor.getSignalQueue(),openContracts:sentinelExecutor.getOpenContracts(),journal:executionJournal.getRecords(),executeManual,updateRisk};
}