"use client";

import { useCallback, useState } from "react";
import { useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";

export function useExecuteActions() {
  const { writeContractAsync } = useWriteContract();
  const [error, setError] = useState<Error | null>(null);

  const withVault = () => {
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
    return addresses.vault;
  };

  const runCollateralDefense = useCallback(async () => {
    setError(null);
    try {
      await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "executeCollateralDefense", args: [] });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  const runPremium = useCallback(async () => {
    setError(null);
    try {
      await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "executePremiumResponse", args: [] });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  const runDiscount = useCallback(async () => {
    setError(null);
    try {
      await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "executeDiscountResponse", args: [] });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  return { runCollateralDefense, runPremium, runDiscount, error };
}
