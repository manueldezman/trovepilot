"use client";

import { useCallback, useState } from "react";
import { useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { MEZO } from "@/lib/mezo";
import { vaultAbi, erc20Abi } from "@/lib/trovePilotAbis";

export function useReserveActions() {
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const deposit = useCallback(
    async (amount: bigint) => {
      setError(null);
      if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
      setIsPending(true);
      try {
        await writeContractAsync({ address: MEZO.musd, abi: erc20Abi, functionName: "approve", args: [addresses.vault, amount] });
        await writeContractAsync({ address: addresses.vault, abi: vaultAbi, functionName: "depositReserve", args: [MEZO.musd, amount] });
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [writeContractAsync]
  );

  const withdraw = useCallback(
    async (amount: bigint) => {
      setError(null);
      if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
      setIsPending(true);
      try {
        await writeContractAsync({ address: addresses.vault, abi: vaultAbi, functionName: "withdrawReserve", args: [MEZO.musd, amount] });
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [writeContractAsync]
  );

  return { deposit, withdraw, isPending, error };
}
