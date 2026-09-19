// SENTINEL EXECUTION JOURNAL & AUDIT LOG
// Records all executed trades, rejected signals, and forensic audit events.
// Persists locally first so the execution journal remains available offline.

import type { ExecutionAuditRecord, AuditEvent, AuditEventType } from "./types";

const JOURNAL_KEY = "sentinel.executor.journal.v1";
const AUDIT_EVENTS_KEY = "sentinel.executor.audit.v1";
const MAX_RECORDS = 500;
const MAX_EVENTS = 1000;

class ExecutionJournal {
  private records: ExecutionAuditRecord[] = [];
  private events: AuditEvent[] = [];
  private listeners = new Set<() => void>();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    try {
      const savedRecords = window.localStorage.getItem(JOURNAL_KEY);
      if (savedRecords) {
        this.records = JSON.parse(savedRecords);
      }
    } catch {
      this.records = [];
    }

    try {
      const savedEvents = window.localStorage.getItem(AUDIT_EVENTS_KEY);
      if (savedEvents) {
        this.events = JSON.parse(savedEvents);
      }
    } catch {
      this.events = [];
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        JOURNAL_KEY,
        JSON.stringify(this.records.slice(-MAX_RECORDS))
      );
      window.localStorage.setItem(
        AUDIT_EVENTS_KEY,
        JSON.stringify(this.events.slice(-MAX_EVENTS))
      );
    } catch {
      // Ignore quota errors
    }
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  recordTrade(record: Omit<ExecutionAuditRecord, "id" | "timestamp" | "executorVersion">): ExecutionAuditRecord {
    this.init();
    const fullRecord: ExecutionAuditRecord = {
      ...record,
      id: `exec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      executorVersion: "Sentinel-Exec-v3.2",
    };

    this.records.unshift(fullRecord);
    if (this.records.length > MAX_RECORDS) {
      this.records.length = MAX_RECORDS;
    }
    this.persist();


    return fullRecord;
  }

  recordRejection(params: {
    signalId: string;
    account: string;
    market: string;
    contract: string;
    barrier: number;
    duration: number;
    stake: number;
    confidence: number;
    confluence: number;
    reason: string;
    mode: "LIVE_AUTO" | "LIVE_MANUAL" | "PAPER_AUTO" | "PAPER_MANUAL";
  }): ExecutionAuditRecord {
    this.init();
    const record: ExecutionAuditRecord = {
      id: `rej_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      signalId: params.signalId,
      timestamp: Date.now(),
      mode: params.mode,
      status: "REJECTED",
      rejectionReason: params.reason,
      account: params.account,
      market: params.market,
      contract: params.contract,
      barrier: params.barrier,
      duration: params.duration,
      stake: params.stake,
      confidence: params.confidence,
      confluence: params.confluence,
      executorVersion: "Sentinel-Exec-v3.2",
    };

    this.records.unshift(record);
    if (this.records.length > MAX_RECORDS) {
      this.records.length = MAX_RECORDS;
    }
    this.persist();

    this.logEvent({
      type: "RISK_CHECK_FAILED",
      signalId: params.signalId,
      message: `Execution blocked: ${params.reason}`,
      details: { market: params.market, contract: params.contract, reason: params.reason },
    });

    return record;
  }

  updateTradeOutcome(
    contractId: string,
    update: {
      settlementSpot?: number;
      sellPrice?: number;
      result: "WIN" | "LOSS" | "SOLD" | "CANCELLED";
      pnl: number;
      durationMs?: number;
    }
  ): void {
    this.init();
    const item = this.records.find((r) => r.contractId === contractId);
    if (item) {
      item.settlementSpot = update.settlementSpot ?? item.settlementSpot;
      item.sellPrice = update.sellPrice;
      item.result = update.result;
      item.pnl = update.pnl;
      item.durationMs = update.durationMs;
      this.persist();
    }
  }

  logEvent(params: {
    type: AuditEventType;
    signalId: string;
    message: string;
    details?: Record<string, any>;
  }): void {
    this.init();
    const event: AuditEvent = {
      id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: params.type,
      signalId: params.signalId,
      message: params.message,
      details: params.details,
    };

    this.events.unshift(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.length = MAX_EVENTS;
    }
    this.persist();
  }

  getRecords(): ExecutionAuditRecord[] {
    this.init();
    return [...this.records];
  }

  getEvents(): AuditEvent[] {
    this.init();
    return [...this.events];
  }

  clearJournal(): void {
    this.records = [];
    this.events = [];
    this.persist();
  }

  getStats() {
    this.init();
    const executed = this.records.filter((r) => r.status === "EXECUTED" && r.result);
    const wins = executed.filter((r) => r.result === "WIN").length;
    const losses = executed.filter((r) => r.result === "LOSS").length;
    const total = wins + losses;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const totalPnl = executed.reduce((acc, r) => acc + (r.pnl ?? 0), 0);

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const dailyTrades = executed.filter((r) => r.timestamp >= oneDayAgo).length;
    const hourlyTrades = executed.filter((r) => r.timestamp >= oneHourAgo).length;

    // Consecutive losses calculation
    let consecutiveLosses = 0;
    for (const r of executed) {
      if (r.result === "LOSS") {
        consecutiveLosses++;
      } else if (r.result === "WIN") {
        break;
      }
    }

    // Daily realized loss
    const dailyRealizedLoss = executed
      .filter((r) => r.timestamp >= oneDayAgo && (r.pnl ?? 0) < 0)
      .reduce((acc, r) => acc + Math.abs(r.pnl ?? 0), 0);

    const rejectedCount = this.records.filter((r) => r.status === "REJECTED").length;

    return {
      totalExecuted: executed.length,
      wins,
      losses,
      winRate,
      totalPnl,
      dailyTrades,
      hourlyTrades,
      consecutiveLosses,
      dailyRealizedLoss,
      rejectedCount,
    };
  }
}

export const executionJournal = new ExecutionJournal();
