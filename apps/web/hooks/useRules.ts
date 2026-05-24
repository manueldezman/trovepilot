"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";

type RulesPayload = {
  minICR: bigint;
  repayBps: bigint;
  premiumThreshold: bigint;
  discountThreshold: bigint;
  maxReserveUseBps: bigint;
  collateralDefenseEnabled: boolean;
  premiumModeEnabled: boolean;
  discountModeEnabled: boolean;
};

export function useRules() {
  const { address } = useAccount();
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const { data } = useReadContract({
    address: addresses.vault,
    abi: vaultAbi,
    functionName: "getRules",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && addresses.vault) }
  });

  const rules = useMemo(() => {
    if (!data) return null;
    const r = data as any;
    return {
      minICR: (Number(r.minICR) ? r.minICR : 0n).toString(),
      repayBps: r.repayBps?.toString?.() ?? "0",
      premiumThreshold: (Number(r.premiumThreshold) ? r.premiumThreshold : 0n).toString(),
      discountThreshold: (Number(r.discountThreshold) ? r.discountThreshold : 0n).toString(),
      maxReserveUseBps: r.maxReserveUseBps?.toString?.() ?? "0",
      collateralDefenseEnabled: Boolean(r.collateralDefenseEnabled),
      premiumModeEnabled: Boolean(r.premiumModeEnabled),
      discountModeEnabled: Boolean(r.discountModeEnabled)
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
