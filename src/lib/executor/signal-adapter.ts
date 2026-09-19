// SENTINEL SIGNAL ADAPTER
// Converts Sentinel RankedOpportunity into the formal ExecutionSignal.
// Never modifies analysis calculations, never invents signals, and NEVER rejects signals
// based on Sentinel's analytical classification (WATCH, NO TRADE, ENTER NOW, etc.).

import type { RankedOpportunity } from "@/lib/apex/types";
import type { ExecutionSignal } from "./types";

export function getContractBarrier(contractId: string): number {
  if (contractId === "UNDER6") return 6;
  if (contractId === "UNDER7") return 7;
  if (contractId === "UNDER8") return 8;
  if (contractId === "OVER1") return 1;
  if (contractId === "OVER2") return 2;
  if (contractId === "OVER3") return 3;
  const match = contractId.match(/\d+/);
  return match ? parseInt(match[0], 10) : 7;
}

/**
 * Validates that an incoming signal object is structurally complete for execution.
 * Only checks execution requirements (market, contractType, barrier, duration).
 */
export function validateSignalStructure(sig: Partial<ExecutionSignal>): { valid: boolean; reason?: string } {
  if (!sig.id) return { valid: false, reason: "Missing unique signal ID" };
  if (!sig.market) return { valid: false, reason: "Missing market/symbol" };
  if (!sig.contractType) return { valid: false, reason: "Missing contract type" };
  if (sig.barrier === undefined || isNaN(sig.barrier)) return { valid: false, reason: "Invalid or missing barrier" };
  if (!sig.duration || sig.duration <= 0) return { valid: false, reason: "Invalid duration" };
  return { valid: true };
}

/**
 * Maps Sentinel's RankedOpportunity into the formal ExecutionSignal.
 * Preserves Sentinel's analytical opinion as informational metadata.
 */
export function buildExecutionSignal(item: RankedOpportunity): ExecutionSignal {
  const c = item.contract;
  const isOver = c.contractType === "DIGITOVER" || c.id.startsWith("OVER");
  const barrier = getContractBarrier(c.id);
  const ep = item.entryPoint;
  const entryDigit = ep?.preferred ? ep.preferred.digit : undefined;
  const duration = ep?.preferred?.n && ep.preferred.n > 0 ? 1 : 1;

  // Preserve Sentinel's authoritative state as information only. Executor
  // never upgrades WATCH/WAIT/BLOCKED to ENTER NOW.
  const sentinelStatus =
    item.signal?.label ||
    item.signal?.state ||
    "UNCLASSIFIED";

  const now = Date.now();
  // Unique signal ID based on market, contract, tick epoch, entry digit
  const tickSec = item.intel?.lastTickAt ? Math.floor(item.intel.lastTickAt / 1000) : Math.floor(now / 1000);
  const id = `SIG-${item.symbol}-${c.id}-${tickSec}-${entryDigit ?? "x"}`;

  return {
    id,
    createdAt: now,
    expiresAt: now + 30000, // Default signal lifetime; Executor max TTL remains configurable

    market: item.symbol,
    marketName: item.name || item.symbol,
    contractType: isOver ? "DIGITOVER" : "DIGITUNDER",
    barrier,
    contractLabel: c.label || `${isOver ? "Over" : "Under"} ${barrier}`,
    duration,
    durationUnit: "t",

    direction: isOver ? "OVER" : "UNDER",
    entryDigit,

    confidence: Math.round(c.confidence ?? 0),
    confluence: Math.round(item.score ?? 0),
    score: Math.round(item.score ?? 0),

    sentinelStatus,

    psychology: {
      winningZoneShare: item.digitPsychology?.score ?? 0,
      losingZoneShare: item.digitPsychology?.confidence ?? 0,
      summary: item.digitPsychology?.summary ?? "Psychology neutral",
    },
    pressure: {
      shortTermImpulse: item.priceAction?.winningSide?.pressure ?? 0,
      losingSideDominance: (item.priceAction?.losingSide?.pressure ?? 0) > (item.priceAction?.winningSide?.pressure ?? 0),
      summary: item.priceAction?.summary ?? "Pressure normal",
    },
    danger: {
      composite: Math.round(item.clearance?.risk ?? c.danger ?? 0),
      clearanceStatus: item.clearance?.state ?? "UNKNOWN",
    },
    liquiditySweep: {
      passed: Boolean(item.observationDossier?.liquiditySweep?.confirmed),
      status: item.observationDossier?.liquiditySweep?.state ?? "UNKNOWN",
    },

    qualificationStatus: item.signal?.state ?? "PENDING",
    sourceVersion: "Sentinel-Core",
    metadata: {
      contractId: c.id,
      intelState: item.intel?.dataState,
      spread: undefined,
      baseSignalId: id,
      runIndex: 1,
      runsTotal: undefined,
    },
  };
}
