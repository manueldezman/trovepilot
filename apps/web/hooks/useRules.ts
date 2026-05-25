"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";

type RulesPayload = {
  safetyICR: bigint;
  repayBps: bigint;
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
    return {
      safetyICR: formatUnits((r.safetyICR ?? 0n) as bigint, 18),
      repayBps: (r.repayBps ?? 0n).toString(),
      premiumThreshold: formatUnits((r.premiumThreshold ?? 0n) as bigint, 18),
      discountThreshold: formatUnits((r.discountThreshold ?? 0n) as bigint, 18),
      maxReserveUseBps: r.maxReserveUseBps?.toString?.() ?? "0",
      safetyReserveBps: r.safetyReserveBps?.toString?.() ?? "0",
      opportunityReserveBps: r.opportunityReserveBps?.toString?.() ?? "0",
      safetyEnabled: Boolean(r.safetyEnabled),
      premiumEnabled: Boolean(r.premiumEnabled),
      discountEnabled: Boolean(r.discountEnabled)
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
