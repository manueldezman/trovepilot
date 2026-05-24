"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useWalletClient, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoBorrowerOperationsSignaturesAbi } from "@/lib/mezoAbis";
import { computeRepayMusdDigest } from "@/lib/borrowerOpsSignatures";

export function useExecuteActions() {
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [error, setError] = useState<Error | null>(null);

  const withVault = () => {
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
    return addresses.vault;
  };

  const runCollateralDefense = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (!walletClient) throw new Error("Wallet client unavailable");

      const [preview, nonce] = await Promise.all([
        publicClient.readContract({ address: withVault(), abi: vaultAbi, functionName: "previewCollateralDefense", args: [address] }),
        publicClient.readContract({
          address: MEZO.borrowerOperationsSignatures,
          abi: mezoBorrowerOperationsSignaturesAbi,
          functionName: "getNonce",
          args: [address]
        })
      ]);

      const repayAmount = (preview as any)[0] as bigint;
      if (repayAmount <= 0n) throw new Error("Collateral defense not needed (or missing rules/reserve).");

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
      const digest = computeRepayMusdDigest({
        amount: repayAmount,
        borrower: address,
        nonce: nonce as bigint,
        deadline,
        chainId,
        verifyingContract: MEZO.borrowerOperationsSignatures
      });

      const signature = (await walletClient.request({
        method: "eth_sign",
        params: [address, digest]
      })) as `0x${string}`;

      await writeContractAsync({
        address: withVault(),
        abi: vaultAbi,
        functionName: "executeCollateralDefense",
        args: [repayAmount, signature, deadline]
      });
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
