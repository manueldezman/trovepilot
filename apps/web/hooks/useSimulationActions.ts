"use client";

import { useCallback, useState } from "react";
import { parseUnits } from "viem";
import { useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { mockMarketOracleAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";

export function useSimulationActions() {
  const { writeContractAsync } = useWriteContract();
  const [error, setError] = useState<Error | null>(null);

  const withAddr = () => {
    if (!addresses.mockMarketOracle) throw new Error("Missing oracle address (set NEXT_PUBLIC_MOCK_MARKET_ORACLE_ADDRESS)");
    return addresses.mockMarketOracle;
  };

  const setBtcDrop15 = useCallback(async () => {
    setError(null);
    try {
      const current = (await publicClient.readContract({
        address: withAddr(),
        abi: mockMarketOracleAbi,
        functionName: "getBTCPrice"
      })) as bigint;
      const next = (current * 85n) / 100n;
      await writeContractAsync({
        address: withAddr(),
        abi: mockMarketOracleAbi,
        functionName: "setBTCPrice",
        args: [next]
      });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  const setPremium103 = useCallback(async () => {
    setError(null);
    try {
      await writeContractAsync({ address: withAddr(), abi: mockMarketOracleAbi, functionName: "setMUSDPrice", args: [parseUnits("1.03", 18)] });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  const setDiscount097 = useCallback(async () => {
    setError(null);
    try {
      await writeContractAsync({ address: withAddr(), abi: mockMarketOracleAbi, functionName: "setMUSDPrice", args: [parseUnits("0.97", 18)] });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  const reset = useCallback(async () => {
    setError(null);
    try {
      await writeContractAsync({ address: withAddr(), abi: mockMarketOracleAbi, functionName: "setBTCPrice", args: [parseUnits("100000", 18)] });
      await writeContractAsync({ address: withAddr(), abi: mockMarketOracleAbi, functionName: "setMUSDPrice", args: [parseUnits("1.00", 18)] });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [writeContractAsync]);

  return { setBtcDrop15, setPremium103, setDiscount097, reset, error };
}
