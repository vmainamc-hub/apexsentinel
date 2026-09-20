// SENTINEL EXECUTOR — STAKE CALCULATION ENGINE
// Single authoritative stake calculator shared by UI preview and the execution pipeline.
// Strictly enforces Martingale safety and caps.

import type { MartingaleSettings } from "./types";

export interface StakeCalculationParams {
  baseStake: number;
  martingaleEnabled: boolean;
  martingaleMultiplier: number;
  recoveryStep: number;
  maxStake: number;
  maxRecoveryStake: number;
  accountBalance?: number | null;
}

export interface StakeCalculationResult {
  stake: number;
  recoveryStep: number;
  isBlocked: boolean;
  blockReason?: string;
  warning?: string;
}

/**
 * Calculates the exact stake to be used for the next trade.
 * Shared between UI preview and the execution engine so values are never out of sync.
 */
export function calculateStake(params: StakeCalculationParams): StakeCalculationResult {
  const {
    baseStake,
    martingaleEnabled,
    martingaleMultiplier,
    recoveryStep,
    maxStake,
    maxRecoveryStake,
    accountBalance,
  } = params;

  // Deriv minimum stake is 0.35 USD
  const cleanBase = Math.max(0.35, Number(baseStake.toFixed(2)));
  const cleanMaxStake = Math.max(cleanBase, Number(maxStake.toFixed(2)));
  const cleanMaxRecovery = Math.max(cleanBase, Number(maxRecoveryStake.toFixed(2)));

  if (!martingaleEnabled || recoveryStep <= 0) {
    // Normal base trade
    const finalStake = Math.min(cleanBase, cleanMaxStake);
    if (accountBalance !== undefined && accountBalance !== null && accountBalance < finalStake) {
      return {
        stake: finalStake,
        recoveryStep: 0,
        isBlocked: true,
        blockReason: `Insufficient account balance ($${accountBalance.toFixed(2)}) for stake ($${finalStake.toFixed(2)})`,
      };
    }
    return {
      stake: finalStake,
      recoveryStep: 0,
      isBlocked: false,
    };
  }

  // Martingale progressive recovery calculation:
  // T(n) = Base * Multiplier ^ step
  const rawStake = cleanBase * Math.pow(martingaleMultiplier, recoveryStep);
  const roundedStake = Number(rawStake.toFixed(2));

  // 1. Check Max Recovery Stake limit
  if (roundedStake > cleanMaxRecovery) {
    return {
      stake: cleanMaxRecovery,
      recoveryStep,
      isBlocked: true,
      blockReason: `RECOVERY BLOCKED: Calculated stake ($${roundedStake.toFixed(2)}) exceeds maximum recovery stake ($${cleanMaxRecovery.toFixed(2)})`,
    };
  }

  // 2. Check Global Max Stake limit
  if (roundedStake > cleanMaxStake) {
    return {
      stake: cleanMaxStake,
      recoveryStep,
      isBlocked: true,
      blockReason: `RECOVERY BLOCKED: Calculated stake ($${roundedStake.toFixed(2)}) exceeds max stake limit ($${cleanMaxStake.toFixed(2)})`,
    };
  }

  // 3. Check Account Balance Protection
  if (accountBalance !== undefined && accountBalance !== null && accountBalance < roundedStake) {
    return {
      stake: roundedStake,
      recoveryStep,
      isBlocked: true,
      blockReason: `RECOVERY BLOCKED: Insufficient account balance ($${accountBalance.toFixed(2)}) for recovery stake ($${roundedStake.toFixed(2)})`,
    };
  }

  return {
    stake: roundedStake,
    recoveryStep,
    isBlocked: false,
  };
}

/**
 * "Split martingale" recovery — as opposed to a full martingale that tries to
 * recover the entire running loss in a single trade, this divides the
 * required recovery amount across `split` steps, so each recovery trade only
 * needs to claw back a fraction of the total. Formula:
 *   stake = (totalLost * (100 / payoutPercent)) / split
 * Clamped to the same safety caps as the exponential calculator.
 */
export interface SplitStakeParams {
  totalLost: number;
  payoutPercent: number;
  split: number;
  maxStake: number;
  maxRecoveryStake: number;
  accountBalance?: number | null;
}

export function calculateSplitStake(params: SplitStakeParams): StakeCalculationResult {
  const { totalLost, payoutPercent, split, maxStake, maxRecoveryStake, accountBalance } = params;
  const cleanMaxStake = Math.max(0.35, Number(maxStake.toFixed(2)));
  const cleanMaxRecovery = Math.max(0.35, Number(maxRecoveryStake.toFixed(2)));
  const cleanPayout = Math.max(1, payoutPercent);
  const cleanSplit = Math.max(1, split);

  if (totalLost <= 0) {
    return { stake: 0.35, recoveryStep: 0, isBlocked: false };
  }

  const raw = (totalLost * (100 / cleanPayout)) / cleanSplit;
  const roundedStake = Math.max(0.35, Number(raw.toFixed(2)));

  if (roundedStake > cleanMaxRecovery) {
    return {
      stake: cleanMaxRecovery,
      recoveryStep: 1,
      isBlocked: true,
      blockReason: `RECOVERY BLOCKED: Split-martingale stake (${roundedStake.toFixed(2)}) exceeds maximum recovery stake (${cleanMaxRecovery.toFixed(2)})`,
    };
  }
  if (roundedStake > cleanMaxStake) {
    return {
      stake: cleanMaxStake,
      recoveryStep: 1,
      isBlocked: true,
      blockReason: `RECOVERY BLOCKED: Split-martingale stake (${roundedStake.toFixed(2)}) exceeds max stake limit (${cleanMaxStake.toFixed(2)})`,
    };
  }
  if (accountBalance !== undefined && accountBalance !== null && accountBalance < roundedStake) {
    return {
      stake: roundedStake,
      recoveryStep: 1,
      isBlocked: true,
      blockReason: `RECOVERY BLOCKED: Insufficient account balance (${accountBalance.toFixed(2)}) for recovery stake (${roundedStake.toFixed(2)})`,
    };
  }

  return { stake: roundedStake, recoveryStep: 1, isBlocked: false };
}

/**
 * Returns a table of planned recovery steps for visual inspection in UI.
 */
export function generateRecoveryStepsTable(
  baseStake: number,
  multiplier: number,
  maxSteps: number,
  maxRecoveryStake: number
): Array<{ step: number; stake: number; isWithinCap: boolean }> {
  const steps: Array<{ step: number; stake: number; isWithinCap: boolean }> = [];
  const cleanBase = Math.max(0.35, baseStake);

  for (let i = 0; i <= maxSteps; i++) {
    const raw = i === 0 ? cleanBase : cleanBase * Math.pow(multiplier, i);
    const stake = Number(raw.toFixed(2));
    steps.push({
      step: i,
      stake,
      isWithinCap: stake <= maxRecoveryStake,
    });
  }

  return steps;
}
