"use client";

import { useCallback, useState } from "react";
import { parseUnits } from "viem";
import { useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoPriceFeedAbi } from "@/lib/mezoAbis";

export function useSimulationActions() {
  const { writeContractAsync } = useWriteContract();
  const [error, setError] = useState<Error | null>(null);

  const withVault = () => {
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
    return addresses.vault;
  };

  async function readProtocolBtcPrice(): Promise<bigint> {
    const price = (await publicClient.readContract({
      address: MEZO.priceFeed,
      abi: mezoPriceFeedAbi,
      functionName: "fetchPrice"
    })) as bigint;
    return price;
  }

  const setBtcDrop15 = useCallback(async () => {
    setError(null);
    try {
      const current = await readProtocolBtcPrice();
      const next = (current * 85n) / 100n;
      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedBTCPrice", args: [next] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

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
      // Reset should re-base to current Mezo protocol BTC price and reset MUSD peg to 1.00.
      const btc = await readProtocolBtcPrice();
      const h1 = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedBTCPrice", args: [btc] });
      await publicClient.waitForTransactionReceipt({ hash: h1 });
      const h2 = await writeContractAsync({
        address: withVault(),
        abi: vaultAbi,
        functionName: "setSimulatedMUSDPrice",
        args: [parseUnits("1.00", 18)]
      });
      await publicClient.waitForTransactionReceipt({ hash: h2 });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  return { setBtcDrop15, setPremium103, setDiscount097, reset, error };
}
