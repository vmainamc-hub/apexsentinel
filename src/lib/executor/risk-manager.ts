// SENTINEL EXECUTION GATE & RISK MANAGER
// Enforces pure execution validation, account safety, and configured risk limits.
// Does NOT filter or reject signals based on Sentinel analytical opinions.

import type {
  ExecutionSignal,
  RiskSettings,
  GateEvaluationResult,
  ExecutionMode,
  SessionState,
} from "./types";
import { validateSignalStructure } from "./signal-adapter";

export interface EvaluationContext {
  signal: ExecutionSignal;
  mode: ExecutionMode;
  isAutoTrigger: boolean;
  autoState: "OFF" | "ON" | "PAUSED";
  risk: RiskSettings;
  session: SessionState;
  account: {
    connected: boolean;
    loginid?: string;
    balance?: number | null;
    currency?: string | null;
  };
  feedFresh: boolean;
  lastTickAgeMs: number;
  openContractsCount: number;
  effectiveStake: number;
}

export class RiskManager {
  private executedSignalIds = new Set<string>();
  private pendingExecutionLocks = new Set<string>();

  isSignalExecuted(signalId: string): boolean {
    return this.executedSignalIds.has(signalId);
  }

  markSignalExecuted(signalId: string): void {
    this.executedSignalIds.add(signalId);
  }

  clearExecutedSignals(): void {
    this.executedSignalIds.clear();
  }

  isExecutionLocked(lockKey: string): boolean {
    return this.pendingExecutionLocks.has(lockKey);
  }

  acquireLock(lockKey: string): boolean {
    if (this.pendingExecutionLocks.has(lockKey)) return false;
    this.pendingExecutionLocks.add(lockKey);
    return true;
  }

  releaseLock(lockKey: string): void {
    this.pendingExecutionLocks.delete(lockKey);
  }

  evaluateExecutionGates(ctx: EvaluationContext): GateEvaluationResult {
    const {
      signal,
      mode,
      isAutoTrigger,
      autoState,
      risk,
      session,
      account,
      feedFresh,
      lastTickAgeMs,
      openContractsCount,
      effectiveStake,
    } = ctx;

    const now = Date.now();

    // 1. Structural Signal Completeness Validation
    const structCheck = validateSignalStructure(signal);
    if (!structCheck.valid) {
      return {
        ok: false,
        gateName: "INVALID_SIGNAL_STRUCTURE",
        reason: `INVALID SIGNAL: ${structCheck.reason}`,
      };
    }

    // 2. Duplicate Signal Protection (Idempotency - applies to AUTO mode)
    if (isAutoTrigger && risk.duplicateProtection && this.isSignalExecuted(signal.id)) {
      return {
        ok: false,
        gateName: "DUPLICATE_SIGNAL",
        reason: `DUPLICATE SIGNAL: ${signal.id} already executed. Auto duplicate suppressed.`,
      };
    }

    // 3. Auto Mode State & Policy (Only applies to AUTO triggers)
    if (isAutoTrigger) {
      if (autoState === "OFF") {
        return {
          ok: false,
          gateName: "AUTO_OFF",
          reason: "Auto execution is OFF. Switch Master Auto to ON to execute automatically.",
        };
      }
      if (autoState === "PAUSED") {
        return {
          ok: false,
          gateName: "AUTO_PAUSED",
          reason: `Auto execution is PAUSED (${session.pauseReason || "Safety pause active"}).`,
        };
      }

      // Check Auto Signal Policy
      if (risk.autoSignalPolicy === "SELECTED_TYPES") {
        if (!risk.allowedContractTypes.includes(signal.contractType)) {
          return {
            ok: false,
            gateName: "POLICY_CONTRACT_EXCLUDED",
            reason: `Contract type ${signal.contractType} is not in allowed auto execution types.`,
          };
        }
      }
    }

    // 4. Signal Expiration / Age
    const signalAgeMs = now - signal.createdAt;
    const maxAllowedAgeMs = isAutoTrigger
      ? Math.max(30, risk.maxSignalAgeSeconds) * 1000
      : 120 * 1000; // Manual execution permits up to 120s for staged signals

    if (signalAgeMs > maxAllowedAgeMs) {
      return {
        ok: false,
        gateName: "SIGNAL_EXPIRED",
        reason: `SIGNAL EXPIRED: Signal age (${(signalAgeMs / 1000).toFixed(1)}s) exceeds max allowed age (${(maxAllowedAgeMs / 1000).toFixed(0)}s).`,
      };
    }

    // 5. Cooldown Enforcement
    if (isAutoTrigger && session.cooldownUntil > now) {
      const remainingSec = Math.ceil((session.cooldownUntil - now) / 1000);
      return {
        ok: false,
        gateName: "COOLDOWN_ACTIVE",
        reason: `COOLDOWN: Execution waiting (${remainingSec}s remaining).`,
      };
    }

    // 6. Account Status & Authorization (Live Mode)
    if (mode === "LIVE") {
      if (!account.connected || !account.loginid) {
        return {
          ok: false,
          gateName: "ACCOUNT_DISCONNECTED",
          reason: "ACCOUNT DISCONNECTED: Connect and authorize an active Deriv account to trade.",
        };
      }
      if (account.balance === null || account.balance === undefined) {
        return {
          ok: false,
          gateName: "BALANCE_UNKNOWN",
          reason: "ACCOUNT: Unable to verify live Deriv account balance.",
        };
      }
      if (account.balance < effectiveStake) {
        return {
          ok: false,
          gateName: "INSUFFICIENT_BALANCE",
          reason: `ACCOUNT: Insufficient balance ($${account.balance.toFixed(2)}) for stake ($${effectiveStake.toFixed(2)}).`,
        };
      }
    }

    // 7. Stake Bounds
    if (effectiveStake < 0.35) {
      return {
        ok: false,
        gateName: "INVALID_STAKE",
        reason: "INVALID STAKE: Configured stake must be at least Deriv minimum ($0.35).",
      };
    }
    if (effectiveStake > risk.maxStake) {
      return {
        ok: false,
        gateName: "STAKE_EXCEEDS_MAX",
        reason: `STAKE LIMIT: Stake ($${effectiveStake.toFixed(2)}) exceeds max stake limit ($${risk.maxStake.toFixed(2)}).`,
      };
    }

    // 8. Open Contracts Limit
    if (openContractsCount >= risk.maxOpenContracts) {
      return {
        ok: false,
        gateName: "MAX_OPEN_CONTRACTS",
        reason: `LIMIT: Active open contracts (${openContractsCount}) reached limit (${risk.maxOpenContracts}).`,
      };
    }

    // 9. Session Profit / Loss Limits
    if (risk.targetProfit !== null && session.sessionProfit >= risk.targetProfit) {
      return {
        ok: false,
        gateName: "TARGET_PROFIT_REACHED",
        reason: `TARGET PROFIT REACHED: Session profit (+$${session.sessionProfit.toFixed(2)}) reached target ($${risk.targetProfit.toFixed(2)}). Auto execution paused.`,
      };
    }

    if (risk.stopLoss !== null && session.sessionLoss >= risk.stopLoss) {
      return {
        ok: false,
        gateName: "STOP_LOSS_REACHED",
        reason: `STOP LOSS REACHED: Session loss (-$${session.sessionLoss.toFixed(2)}) reached stop loss threshold ($${risk.stopLoss.toFixed(2)}). Auto execution paused.`,
      };
    }

    // 10. Max Consecutive Losses
    if (
      risk.maxConsecutiveLosses !== null &&
      session.consecutiveLosses >= risk.maxConsecutiveLosses
    ) {
      return {
        ok: false,
        gateName: "CONSECUTIVE_LOSS_LIMIT",
        reason: `LIMIT: Max consecutive losses reached (${session.consecutiveLosses}/${risk.maxConsecutiveLosses}). Auto paused.`,
      };
    }

    // 11. Max Trades Limits
    if (
      risk.maxTradesPerSession !== null &&
      session.tradesCount >= risk.maxTradesPerSession
    ) {
      return {
        ok: false,
        gateName: "SESSION_TRADE_LIMIT",
        reason: `LIMIT: Max session trades reached (${session.tradesCount}/${risk.maxTradesPerSession}).`,
      };
    }

    // 12. Max Daily Loss
    if (risk.maxDailyLoss !== null && session.sessionLoss >= risk.maxDailyLoss) {
      return {
        ok: false,
        gateName: "MAX_DAILY_LOSS",
        reason: `LIMIT: Max daily loss reached (-$${session.sessionLoss.toFixed(2)} / $${risk.maxDailyLoss.toFixed(2)}).`,
      };
    }

    // 13. Feed Health (Enforced strictly in LIVE mode only)
    if (mode === "LIVE" && !feedFresh && lastTickAgeMs > 6000) {
      return {
        ok: false,
        gateName: "FEED_STALE",
        reason: `FEED STALE: Deriv tick latency ${lastTickAgeMs}ms is too high.`,
      };
    }

    return { ok: true };
  }
}

export const riskManager = new RiskManager();
