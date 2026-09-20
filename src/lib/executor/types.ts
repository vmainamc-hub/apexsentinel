// SENTINEL SIGNAL EXECUTOR — DATA CONTRACTS
// Authoritative contracts for the Independent Standalone Signal Execution & Trade Management Module.
// Strictly decouples signal reception and display from analytical opinion.

export type ExecutionMode = "LIVE" | "PAPER";

export type ExecutionTrigger = "MANUAL" | "AUTO";

export type ExecutorStatus =
  | "AUTO_OFF"
  | "ARMING"
  | "ARMED"
  | "EXECUTING"
  | "PAUSED"
  | "ERROR"
  | "ACCOUNT_DISCONNECTED"
  | "FEED_STALE"
  | "SIGNAL_INVALID";

export type AutoExecutionState = "OFF" | "ON" | "PAUSED";
export type EntryExecutionMode = "INSTANT" | "WAIT_FOR_ENTRY";
export type SignalExecutionMode = "CONTINUOUS" | "ONE_PER_SIGNAL";
export type RecoveryExecutionMode = "INSTANT" | "NEXT_SIGNAL";

export type AutoSignalPolicy =
  | "EXECUTE_ALL"
  | "SELECTED_TYPES"
  | "MANUAL_CONFIRM"
  | "LOAD_ONLY";

export type SignalQueueState =
  | "RECEIVED"
  | "LOADED"
  | "WAITING"
  | "EXECUTING"
  | "EXECUTED"
  | "EXPIRED"
  | "REJECTED"
  | "SKIPPED";

export interface ExecutionSignal {
  id: string;
  createdAt: number;
  expiresAt: number;

  market: string; // e.g. "R_100", "1HZ10V"
  marketName: string; // e.g. "Volatility 100 (1s) Index"
  contractType: string; // "DIGITUNDER" | "DIGITOVER" | "DIGITEVEN" | "DIGITODD" | etc.
  barrier: number; // e.g. 7 for Under 7, 2 for Over 2
  contractLabel: string; // e.g. "Under 7"
  duration: number; // typically 1
  durationUnit: "t" | "s" | "m";

  direction: string; // "UNDER" | "OVER" | "EVEN" | "ODD"
  entryDigit?: number;

  confidence: number;
  confluence: number;
  score: number; // Sentinel ranking score (0..100)

  // Sentinel analytical classification (informational for the operator, does NOT gate execution)
  sentinelStatus: "ENTER NOW" | "ARMED" | "PREPARE" | "WAIT" | "WATCH" | "NO TRADE" | "BLOCKED" | string;

  psychology?: {
    winningZoneShare: number;
    losingZoneShare: number;
    summary: string;
  };
  pressure?: {
    shortTermImpulse: number;
    losingSideDominance: boolean;
    summary: string;
  };
  danger?: {
    composite: number;
    clearanceStatus: "CLEARED" | "WAIT" | "BLOCKED" | string;
  };
  liquiditySweep?: {
    passed: boolean;
    status: string;
  };

  qualificationStatus?: "QUALIFIED" | "PENDING" | "REJECTED" | string;
  rejectionReasons?: string[];

  sourceVersion?: string;
  metadata?: Record<string, any>;
}

export interface SignalQueueItem {
  signal: ExecutionSignal;
  state: SignalQueueState;
  receivedAt: number;
  rejectionReason?: string;
  executedContractId?: string;
}

export interface MartingaleSettings {
  enabled: boolean;
  baseStake: number;
  multiplier: number;
  maxSteps: number;
  maxRecoveryStake: number;
  resetAfterWin: boolean;
  resetAfterTargetProfit: boolean;
  resetAfterStopLoss: boolean;
}

export interface ProfitLossSettings {
  targetProfit: number | null; // null = OFF
  stopLoss: number | null; // null = OFF
  contractTakeProfit: number | null; // null = OFF
  contractStopLoss: number | null; // null = OFF
  maxDailyProfit: number | null; // null = OFF
  /** Legacy daily-loss control is intentionally OFF by default; session/account stop-loss is authoritative. */
  maxDailyLoss: number | null; // null = OFF
}

export interface TradeLimitsSettings {
  maxTradesPerSession: number | null; // null = OFF
  maxTradesPerHour: number | null;
  maxTradesPerDay: number | null;
  maxConsecutiveLosses: number | null;
  maxOpenContracts: number;
  cooldownSeconds: number;
  maxSignalAgeSeconds: number;
}

export interface AutoPolicySettings {
  policy: AutoSignalPolicy;
  allowedTypes: string[]; // ["DIGITUNDER", "DIGITOVER", "DIGITEVEN", "DIGITODD", "DIGITMATCH", "DIGITDIFF"]
  duplicateProtection: boolean;
}

export interface RiskSettings {
  stake: number;
  maxStake: number;
  currency?: string;
  defaultContractType?: string;
  duration?: number;
  durationUnit?: "t" | "s" | "m";

  // Split martingale / Recovery
  martingaleEnabled: boolean;
  baseStake: number;
  martingaleMultiplier: number;
  martingaleSplit: number;
  payoutPercent: number;
  maxRecoverySteps: number;
  maxRecoveryStake: number;
  resetAfterWin: boolean;
  resetAfterTargetProfit: boolean;
  resetAfterStopLoss: boolean;

  // Profit / Loss
  targetProfit: number | null;
  stopLoss: number | null;
  contractTakeProfit: number | null;
  contractStopLoss: number | null;
  maxDailyProfit: number | null;
  maxDailyLoss: number | null;

  // Limits
  maxTradesPerSession: number;
  maxTradesPerHour: number;
  maxTradesPerDay: number;
  maxConsecutiveLosses: number;
  maxOpenContracts: number;
  cooldownSeconds: number;
  maxSignalAgeSeconds: number;

  // Policy & Presets
  autoSignalPolicy: AutoSignalPolicy;
  allowedContractTypes: string[];
  duplicateProtection: boolean;
  minScore: number;
  minConfidence: number;
  riskPreset?: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE" | "CUSTOM";
  /** Forge multi-run execution controls; these do not alter Sentinel analysis. */
  runsPerSignal?: number;
  recoveryDigit?: number | null;
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  stake: 0.35,
  maxStake: 10.0,
  currency: "USD",
  defaultContractType: "DIGITUNDER",
  duration: 1,
  durationUnit: "t",

  // Martingale OFF by default
  martingaleEnabled: false,
  baseStake: 0.35,
  martingaleMultiplier: 1.2,
  martingaleSplit: 2,
  payoutPercent: 50,
  maxRecoverySteps: 6,
  maxRecoveryStake: 5.0,
  resetAfterWin: true,
  resetAfterTargetProfit: true,
  resetAfterStopLoss: true,
  martingaleMode: "SPLIT",

  targetProfit: 10.0,
  stopLoss: 5.0,
  contractTakeProfit: null,
  contractStopLoss: null,
  maxDailyProfit: null,
  maxDailyLoss: null,

  maxTradesPerSession: 50,
  maxTradesPerHour: 20,
  maxTradesPerDay: 100,
  maxConsecutiveLosses: 6,
  maxOpenContracts: 1,
  cooldownSeconds: 0,
  maxSignalAgeSeconds: 5,

  autoSignalPolicy: "EXECUTE_ALL",
  allowedContractTypes: ["DIGITUNDER", "DIGITOVER", "DIGITEVEN", "DIGITODD"],
  duplicateProtection: true,
  minScore: 0, // Executor does not filter by Sentinel score by default
  minConfidence: 0, // Executor does not filter by Sentinel confidence by default
  riskPreset: "BALANCED",
  recoveryDigitOver: 3,
  recoveryDigitUnder: 6,
  defaultEntryDigitOver: 4,
  defaultEntryDigitUnder: 5,
  entryMode: "WAIT_FOR_ENTRY_DIGIT",
  recoveryTiming: "INSTANT",
  runMode: "PER_SIGNAL",
};

export interface SessionState {
  startingBalance: number | null;
  accountStartBalance: number | null;
  currentAccountBalance: number | null;
  accountPnl: number;
  sessionProfit: number;
  sessionLoss: number;
  netPnl: number;
  tradesCount: number;
  wins: number;
  losses: number;
  winRate: number;
  consecutiveLosses: number;
  currentRecoveryStep: number;
  currentCalculatedStake: number;
  isTargetProfitReached: boolean;
  isStopLossReached: boolean;
  isMaxConsecutiveLossesReached: boolean;
  cooldownUntil: number; // timestamp in ms
  autoState: AutoExecutionState;
  pauseReason?: string;
  recoveryTotalLost: number;
  pendingRecovery: { direction: string; stake: number; digit: number } | null;
}

export interface OpenContract {
  contractId: string;
  signalId: string;
  market: string;
  marketName: string;
  contractType: string;
  contractLabel: string;
  barrier: number;
  durationTicks: number;
  buyPrice: number;
  potentialPayout: number;
  currentSpot?: number;
  entrySpot?: number;
  exitSpot?: number;
  exitDigit?: number;
  currentProfit: number;
  status: "open" | "won" | "lost" | "sold";
  buyTime: number;
  settleTime?: number;
  isSellable: boolean;
  bidPrice?: number;
  mode: ExecutionMode;
  accountLoginid: string;
  /** Multi-run execution metadata; optional for legacy/manual records. */
  baseSignalId?: string;
  runIndex?: number;
  runsTotal?: number;
  entryDigit?: number;
  recoveryDigit?: number | null;
  isRecovery?: boolean;
  executionCycle?: number;
}

export interface DetailedTradeRecord {
  id: string;
  signalId: string;
  account: string;
  symbol: string;
  marketName: string;
  contract: string;
  direction: string;
  barrier: number;
  duration: number;
  durationUnit: string;
  stake: number;
  martingaleStep: number;
  baseStake: number;
  multiplier: number;
  targetProfit: number | null;
  stopLoss: number | null;
  buyPrice: number;
  payout: number;
  contractId: string;
  entrySpot?: number;
  settlementSpot?: number;
  exitDigit?: number;
  result: "WIN" | "LOSS" | "SOLD" | "CANCELLED";
  pnl: number;
  timestamp: number;
  mode: ExecutionMode;
  trigger: ExecutionTrigger;
  durationMs?: number;
  status?: "EXECUTED" | "REJECTED" | "FAILED";
  rejectionReason?: string;
}

export interface ExecutionAuditRecord {
  id: string;
  signalId: string;
  timestamp: number;
  mode: "LIVE_AUTO" | "LIVE_MANUAL" | "PAPER_AUTO" | "PAPER_MANUAL";
  status: "EXECUTED" | "REJECTED" | "FAILED";
  rejectionReason?: string;
  account: string;
  market: string;
  contract: string;
  barrier: number;
  duration: number;
  stake: number;
  proposalId?: string;
  contractId?: string;
  buyPrice?: number;
  payout?: number;
  entrySpot?: number;
  settlementSpot?: number;
  sellPrice?: number;
  result?: "WIN" | "LOSS" | "SOLD" | "CANCELLED";
  pnl?: number;
  confidence?: number;
  confluence?: number;
  psychologySummary?: string;
  pressureSummary?: string;
  dangerScore?: number;
  liquidityStatus?: string;
  entryDigit?: number;
  durationMs?: number;
  executorVersion: string;
}

export type AuditEventType =
  | "SIGNAL_RECEIVED"
  | "SIGNAL_LOADED"
  | "SIGNAL_EXPIRED"
  | "EXECUTION_REQUESTED"
  | "RISK_CHECK_PASSED"
  | "RISK_CHECK_FAILED"
  | "PROPOSAL_REQUESTED"
  | "PROPOSAL_RECEIVED"
  | "PROPOSAL_REJECTED"
  | "BUY_REQUESTED"
  | "BUY_CONFIRMED"
  | "BUY_FAILED"
  | "CONTRACT_OPENED"
  | "CONTRACT_UPDATED"
  | "CONTRACT_SETTLED"
  | "CONTRACT_SOLD"
  | "COOLDOWN_STARTED"
  | "TARGET_PROFIT_REACHED"
  | "STOP_LOSS_REACHED"
  | "STOP"
  | "AUTO_PAUSED"
  | "AUTO_RESUMED"
  | "RECOVERY_STEP_ADVANCED"
  | "RECOVERY_RESET"
  | "EXECUTION_FAILED";

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  signalId: string;
  message: string;
  details?: Record<string, any>;
}

export interface GateEvaluationResult {
  ok: boolean;
  gateName?: string;
  reason?: string;
}
