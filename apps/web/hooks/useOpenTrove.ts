"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { MEZO, mezoExplorerUrl, mezoChainId } from "@/lib/mezo";
import { mezoBorrowerOperationsAbi } from "@/lib/mezoAbis";

export function useOpenTrove() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const txUrl = useMemo(() => {
    if (!txHash) return null;
    return `${mezoExplorerUrl}/tx/${txHash}`;
  }, [txHash]);

  const openTrove = useCallback(
    async ({ collateralValue, debtAmount }: { collateralValue: bigint; debtAmount: bigint }) => {
      setError(null);
      setTxHash(null);
      if (!isConnected || !address) throw new Error("Connect a wallet first");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);
      if (collateralValue <= 0n) throw new Error("Collateral must be > 0");
      if (debtAmount <= 0n) throw new Error("Debt must be > 0");

      setIsPending(true);
      try {
        const hash = await writeContractAsync({
          address: MEZO.borrowerOperations,
          abi: mezoBorrowerOperationsAbi,
          functionName: "openTrove",
          args: [debtAmount, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"],
          value: collateralValue
        });
        setTxHash(hash);
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [address, chainId, isConnected, writeContractAsync]
  );

  return { openTrove, isPending, error, txUrl };
}

