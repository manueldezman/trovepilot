"use client";

import { useCallback, useState } from "react";
import { useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { MEZO } from "@/lib/mezo";
import { vaultAbi, erc20Abi } from "@/lib/trovePilotAbis";
import { notifyError, notifySuccess } from "@/lib/notify";

export function useReserveActions() {
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const deposit = useCallback(
    async (amount: bigint) => {
      setError(null);
      if (!addresses.vault) {
        const err = new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
        setError(err);
        notifyError(err.message, "Configuration required");
        return false;
      }
      setIsPending(true);
      try {
        await writeContractAsync({ address: MEZO.musd, abi: erc20Abi, functionName: "approve", args: [addresses.vault, amount] });
        await writeContractAsync({ address: addresses.vault, abi: vaultAbi, functionName: "depositReserveMUSD", args: [amount] });
        notifySuccess("Deposit submitted.");
        return true;
      } catch (e) {
        const err = e as Error;
        setError(err);
        notifyError(err.message);
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [writeContractAsync]
  );

  const withdraw = useCallback(
    async (amount: bigint) => {
      setError(null);
      if (!addresses.vault) {
        const err = new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
        setError(err);
        notifyError(err.message, "Configuration required");
        return false;
      }
      setIsPending(true);
      try {
        await writeContractAsync({ address: addresses.vault, abi: vaultAbi, functionName: "withdrawReserveMUSD", args: [amount] });
        notifySuccess("Withdrawal submitted.");
        return true;
      } catch (e) {
        const err = e as Error;
        setError(err);
        notifyError(err.message);
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [writeContractAsync]
  );

  return { deposit, withdraw, isPending, error };
}
