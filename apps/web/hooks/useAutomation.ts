"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useSignTypedData, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { MEZO, mezoChainId } from "@/lib/mezo";
import { mezoBorrowerOperationsSignaturesAbi } from "@/lib/mezoAbis";

export type SafetyPreview = {
  triggered: boolean;
  repayAmount: bigint;
  icr: bigint;
  btcPrice: bigint;
  safetyICR: bigint;
  safetyReserveBalance: bigint;
};

export type PegPreview = {
  musdPrice: bigint;
  premiumActive: boolean;
  discountActive: boolean;
  premiumThreshold: bigint;
  discountThreshold: bigint;
  opportunityReserveBalance: bigint;
  estGain: bigint;
  estSavings: bigint;
};

export function useAutomation() {
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const [error, setError] = useState<Error | null>(null);

  const withVault = () => {
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
    return addresses.vault;
  };

  const previewSafety = useCallback(async (): Promise<SafetyPreview> => {
    if (!address) throw new Error("Connect a wallet");
    const res = (await publicClient.readContract({
      address: withVault(),
      abi: vaultAbi,
      functionName: "previewSafety",
      args: [address]
    })) as any;

    return {
      triggered: Boolean(res.triggered ?? res[0]),
      repayAmount: (res.repayAmount ?? res[1]) as bigint,
      icr: (res.icr ?? res[2]) as bigint,
      btcPrice: (res.btcPrice ?? res[3]) as bigint,
      safetyICR: (res.safetyICR ?? res[4]) as bigint,
      safetyReserveBalance: (res.safetyReserveBalance ?? res[5]) as bigint
    };
  }, [address]);

  const previewPeg = useCallback(async (): Promise<PegPreview> => {
    if (!address) throw new Error("Connect a wallet");
    const res = (await publicClient.readContract({
      address: withVault(),
      abi: vaultAbi,
      functionName: "previewPeg",
      args: [address]
    })) as any;

    return {
      musdPrice: (res.musdPrice ?? res[0]) as bigint,
      premiumActive: Boolean(res.premiumActive ?? res[1]),
      discountActive: Boolean(res.discountActive ?? res[2]),
      premiumThreshold: (res.premiumThreshold ?? res[3]) as bigint,
      discountThreshold: (res.discountThreshold ?? res[4]) as bigint,
      opportunityReserveBalance: (res.opportunityReserveBalance ?? res[5]) as bigint,
      estGain: (res.estGain ?? res[6]) as bigint,
      estSavings: (res.estSavings ?? res[7]) as bigint
    };
  }, [address]);

  const runSafety = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);

      const preview = await previewSafety();

      // Only request a signature when a real safety repay will execute.
      if (preview.triggered && preview.repayAmount > 0n) {
        const nonce = (await publicClient.readContract({
          address: MEZO.borrowerOperationsSignatures,
          abi: mezoBorrowerOperationsSignaturesAbi,
          functionName: "getNonce",
          args: [address]
        })) as bigint;

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
        const signature = (await signTypedDataAsync({
          domain: {
            name: "BorrowerOperationsSignatures",
            version: "1",
            chainId,
            verifyingContract: MEZO.borrowerOperationsSignatures
          },
          types: {
            RepayMUSD: [
              { name: "amount", type: "uint256" },
              { name: "borrower", type: "address" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" }
            ]
          },
          primaryType: "RepayMUSD",
          message: {
            amount: preview.repayAmount,
            borrower: address,
            nonce,
            deadline
          }
        })) as `0x${string}`;

        const hash = await writeContractAsync({
          address: withVault(),
          abi: vaultAbi,
          functionName: "runSafety",
          args: [signature, deadline]
        });
        await publicClient.waitForTransactionReceipt({ hash });
        return;
      }

      const hash = await writeContractAsync({
        address: withVault(),
        abi: vaultAbi,
        functionName: "runSafety",
        args: ["0x", 0n]
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, previewSafety, signTypedDataAsync, writeContractAsync]);

  const runPeg = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);

      const hash = await writeContractAsync({
        address: withVault(),
        abi: vaultAbi,
        functionName: "runPeg",
        args: []
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, writeContractAsync]);

  return { previewSafety, previewPeg, runSafety, runPeg, error };
}

