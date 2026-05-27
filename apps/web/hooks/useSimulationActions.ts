"use client";

import { useCallback, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoPriceFeedAbi } from "@/lib/mezoAbis";
import { notifyError } from "@/lib/notify";

export function useSimulationActions() {
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();
  const [error, setError] = useState<Error | null>(null);

  const withVault = () => {
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
    return addresses.vault;
  };

  async function readBaseBtcPrice(): Promise<bigint> {
    if (!address) throw new Error("Connect a wallet");
    const [simBtc, protocolBtc] = await Promise.all([
      publicClient.readContract({ address: withVault(), abi: vaultAbi, functionName: "getSimulatedBTCPrice", args: [address] }) as Promise<bigint>,
      publicClient.readContract({ address: MEZO.priceFeed, abi: mezoPriceFeedAbi, functionName: "fetchPrice" }) as Promise<bigint>
    ]);
    // If a simulated price is already set, compound shocks from the current sim value.
    // Otherwise, base shocks off the current protocol price.
    return simBtc > 0n ? simBtc : protocolBtc;
  }

  const setBtcDown = useCallback(
    async (pct: number) => {
      setError(null);
      try {
        const base = await readBaseBtcPrice();
        const p = BigInt(Math.max(0, Math.min(100, Math.round(pct))));
        const next = (base * (100n - p)) / 100n;
        const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedBTCPrice", args: [next] });
        await publicClient.waitForTransactionReceipt({ hash });
      } catch (e) {
        const err = e as Error;
        setError(err);
        notifyError(err.message);
        throw e;
      }
    },
    [address, writeContractAsync]
  );

  const setBtcUp = useCallback(
    async (pct: number) => {
      setError(null);
      try {
        const base = await readBaseBtcPrice();
        const p = BigInt(Math.max(0, Math.min(100, Math.round(pct))));
        const next = (base * (100n + p)) / 100n;
        const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedBTCPrice", args: [next] });
        await publicClient.waitForTransactionReceipt({ hash });
      } catch (e) {
        const err = e as Error;
        setError(err);
        notifyError(err.message);
        throw e;
      }
    },
    [address, writeContractAsync]
  );

  const setPremium103 = useCallback(async () => {
    setError(null);
    try {
      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedMUSDPrice", args: [parseUnits("1.03", 18)] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      const err = e as Error;
      setError(err);
      notifyError(err.message);
      throw e;
    }
  }, [writeContractAsync]);

  const setDiscount097 = useCallback(async () => {
    setError(null);
    try {
      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedMUSDPrice", args: [parseUnits("0.97", 18)] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      const err = e as Error;
      setError(err);
      notifyError(err.message);
      throw e;
    }
  }, [writeContractAsync]);

  const reset = useCallback(async () => {
    setError(null);
    try {
      const btc = (await publicClient.readContract({
        address: MEZO.priceFeed,
        abi: mezoPriceFeedAbi,
        functionName: "fetchPrice"
      })) as bigint;
      const h1 = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedBTCPrice", args: [btc] });
      await publicClient.waitForTransactionReceipt({ hash: h1 });
      const h2 = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "setSimulatedMUSDPrice", args: [parseUnits("1.00", 18)] });
      await publicClient.waitForTransactionReceipt({ hash: h2 });
    } catch (e) {
      const err = e as Error;
      setError(err);
      notifyError(err.message);
      throw e;
    }
  }, [writeContractAsync]);

  return { setBtcDown, setBtcUp, setPremium103, setDiscount097, reset, error };
}
