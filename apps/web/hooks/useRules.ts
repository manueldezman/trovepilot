"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";

type RulesPayload = {
  safetyICR: bigint;
  premiumThreshold: bigint;
  discountThreshold: bigint;
  maxReserveUseBps: bigint;
  safetyReserveBps: bigint;
  opportunityReserveBps: bigint;
  safetyEnabled: boolean;
  premiumEnabled: boolean;
  discountEnabled: boolean;
};

export function useRules() {
  const { address } = useAccount();
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const { data } = useReadContract({
    address: addresses.vault ?? undefined,
    abi: vaultAbi,
    functionName: "getRules",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && addresses.vault) }
  });

  const rules = useMemo(() => {
    if (!data) return null;
    const r = data as any;
    const raw = {
      safetyICR: (r.safetyICR ?? 0n) as bigint,
      premiumThreshold: (r.premiumThreshold ?? 0n) as bigint,
      discountThreshold: (r.discountThreshold ?? 0n) as bigint,
      maxReserveUseBps: (r.maxReserveUseBps ?? 0n) as bigint,
      safetyReserveBps: (r.safetyReserveBps ?? 0n) as bigint,
      opportunityReserveBps: (r.opportunityReserveBps ?? 0n) as bigint,
      safetyEnabled: Boolean(r.safetyEnabled),
      premiumEnabled: Boolean(r.premiumEnabled),
      discountEnabled: Boolean(r.discountEnabled)
    };

    const looksUnset =
      raw.safetyICR === 0n &&
      raw.premiumThreshold === 0n &&
      raw.discountThreshold === 0n &&
      raw.maxReserveUseBps === 0n &&
      raw.safetyReserveBps === 0n &&
      raw.opportunityReserveBps === 0n &&
      raw.safetyEnabled === false &&
      raw.premiumEnabled === false &&
      raw.discountEnabled === false;

    if (looksUnset) return null;
    return {
      safetyICR: formatUnits(raw.safetyICR, 18),
      premiumThreshold: formatUnits(raw.premiumThreshold, 18),
      discountThreshold: formatUnits(raw.discountThreshold, 18),
      maxReserveUseBps: bpsToPercentString(raw.maxReserveUseBps),
      safetyReserveBps: bpsToPercentString(raw.safetyReserveBps),
      opportunityReserveBps: bpsToPercentString(raw.opportunityReserveBps),
      safetyEnabled: raw.safetyEnabled,
      premiumEnabled: raw.premiumEnabled,
      discountEnabled: raw.discountEnabled
    };
  }, [data]);

  const setRules = useCallback(
    async (payload: RulesPayload) => {
      setError(null);
      if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
      setIsPending(true);
      try {
        await writeContractAsync({ address: addresses.vault, abi: vaultAbi, functionName: "setRules", args: [payload] });
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [writeContractAsync]
  );

  return { rules, setRules, isPending, error };
}

function bpsToPercentString(bps: bigint): string {
  const sign = bps < 0n ? "-" : "";
  const v = bps < 0n ? -bps : bps;
  const whole = v / 100n;
  const frac = v % 100n;
  if (frac === 0n) return `${sign}${whole.toString()}`;
  const frac2 = frac.toString().padStart(2, "0").replace(/0+$/, "");
  return `${sign}${whole.toString()}.${frac2}`;
}
