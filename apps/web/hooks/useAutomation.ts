"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useSignMessage, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { MEZO, mezoChainId } from "@/lib/mezo";
import { mezoBorrowerOperationsSignaturesAbi } from "@/lib/mezoAbis";
import { computeRepayMusdDigest } from "@/lib/borrowerOpsSignatures";

type Preview = {
  needsSafetyRepay: boolean;
  repayAmount: bigint;
  icr: bigint;
  btcPrice: bigint;
  musdPrice: bigint;
  premiumActive: boolean;
  discountActive: boolean;
};

export function useAutomation() {
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const [error, setError] = useState<Error | null>(null);

  const withVault = () => {
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
    return addresses.vault;
  };

  const previewAutomation = useCallback(async (): Promise<Preview> => {
    if (!address) throw new Error("Connect a wallet");
    const res = (await publicClient.readContract({
      address: withVault(),
      abi: vaultAbi,
      functionName: "previewAutomation",
      args: [address]
    })) as any;

    return {
      needsSafetyRepay: Boolean(res.needsSafetyRepay ?? res[0]),
      repayAmount: (res.repayAmount ?? res[1]) as bigint,
      icr: (res.icr ?? res[2]) as bigint,
      btcPrice: (res.btcPrice ?? res[3]) as bigint,
      musdPrice: (res.musdPrice ?? res[4]) as bigint,
      premiumActive: Boolean(res.premiumActive ?? res[5]),
      discountActive: Boolean(res.discountActive ?? res[6])
    };
  }, [address]);

  const runAutomation = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);

      const preview = await previewAutomation();

      // Only request a signature when a real safety repay will execute.
      if (preview.needsSafetyRepay && preview.repayAmount > 0n) {
        const nonce = (await publicClient.readContract({
          address: MEZO.borrowerOperationsSignatures,
          abi: mezoBorrowerOperationsSignaturesAbi,
          functionName: "getNonce",
          args: [address]
        })) as bigint;

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
        const digest = computeRepayMusdDigest({
          amount: preview.repayAmount,
          borrower: address,
          nonce,
          deadline,
          chainId,
          verifyingContract: MEZO.borrowerOperationsSignatures
        });

        const signature = (await signMessageAsync({ message: { raw: digest } })) as `0x${string}`;
        const hash = await writeContractAsync({
          address: withVault(),
          abi: vaultAbi,
          functionName: "runAutomation",
          args: [signature, deadline]
        });
        await publicClient.waitForTransactionReceipt({ hash });
        return;
      }

      const hash = await writeContractAsync({
        address: withVault(),
        abi: vaultAbi,
        functionName: "runAutomation",
        args: ["0x", 0n]
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, previewAutomation, signMessageAsync, writeContractAsync]);

  return { runAutomation, previewAutomation, error };
}

