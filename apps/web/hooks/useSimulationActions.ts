"use client";

import { useCallback, useState } from "react";
import { parseUnits } from "viem";
import { useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { useAutomation } from "@/hooks/useAutomation";

export function useSimulationActions() {
  const { writeContractAsync } = useWriteContract();
  const [error, setError] = useState<Error | null>(null);
  const { previewAutomation } = useAutomation();

  const withVault = () => {
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
    return addresses.vault;
  };

  const setBtcDrop15 = useCallback(async () => {
    setError(null);
    try {
      const currentPreview = await previewAutomation();
      const current = currentPreview.btcPrice;
      const next = (current * 85n) / 100n;
      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedBTCPrice", args: [next] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [previewAutomation, writeContractAsync]);

  const setPremium103 = useCallback(async () => {
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: withVault(),
        abi: vaultAbi,
        functionName: "setSimulatedMUSDPrice",
        args: [parseUnits("1.03", 18)]
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  const setDiscount097 = useCallback(async () => {
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: withVault(),
        abi: vaultAbi,
        functionName: "setSimulatedMUSDPrice",
        args: [parseUnits("0.97", 18)]
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  const reset = useCallback(async () => {
    setError(null);
    try {
      const h = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "resetSimulatedMarket", args: [] });
      await publicClient.waitForTransactionReceipt({ hash: h });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  return { setBtcDrop15, setPremium103, setDiscount097, reset, error };
}
