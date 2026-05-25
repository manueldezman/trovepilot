"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useSignTypedData, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { MEZO, mezoChainId } from "@/lib/mezo";
import { mezoBorrowerOperationsSignaturesAbi } from "@/lib/mezoAbis";

export type BtcDownPreview = {
  triggered: boolean;
  repayAmount: bigint;
  icr: bigint;
  btcPrice: bigint;
  bandLower: bigint;
  targetICR: bigint;
  musdReserve: bigint;
};

export type BtcUpPreview = {
  triggered: boolean;
  mintAmount: bigint;
  icr: bigint;
  btcPrice: bigint;
  bandUpper: bigint;
  targetICR: bigint;
};

export type PremiumPreview = {
  active: boolean;
  musdPrice: bigint;
  sellMusd: bigint;
  estUsdcOut: bigint;
  musdReserve: bigint;
  usdcReserve: bigint;
};

export type DiscountPreview = {
  active: boolean;
  musdPrice: bigint;
  spendUsdc: bigint;
  estMusdOut: bigint;
  musdReserve: bigint;
  usdcReserve: bigint;
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

  const nonceFor = useCallback(async (): Promise<bigint> => {
    if (!address) throw new Error("Connect a wallet");
    return (await publicClient.readContract({
      address: MEZO.borrowerOperationsSignatures,
      abi: mezoBorrowerOperationsSignaturesAbi,
      functionName: "getNonce",
      args: [address]
    })) as bigint;
  }, [address]);

  const previewBtcDown = useCallback(async (): Promise<BtcDownPreview> => {
    if (!address) throw new Error("Connect a wallet");
    const res = (await publicClient.readContract({
      address: withVault(),
      abi: vaultAbi,
      functionName: "previewBtcDown",
      args: [address]
    })) as any;

    return {
      triggered: Boolean(res.triggered ?? res[0]),
      repayAmount: (res.repayAmount ?? res[1]) as bigint,
      icr: (res.icr ?? res[2]) as bigint,
      btcPrice: (res.btcPrice ?? res[3]) as bigint,
      bandLower: (res.bandLower ?? res[4]) as bigint,
      targetICR: (res.targetICR ?? res[5]) as bigint,
      musdReserve: (res.musdReserve ?? res[6]) as bigint
    };
  }, [address]);

  const previewBtcUp = useCallback(async (): Promise<BtcUpPreview> => {
    if (!address) throw new Error("Connect a wallet");
    const res = (await publicClient.readContract({
      address: withVault(),
      abi: vaultAbi,
      functionName: "previewBtcUp",
      args: [address]
    })) as any;

    return {
      triggered: Boolean(res.triggered ?? res[0]),
      mintAmount: (res.mintAmount ?? res[1]) as bigint,
      icr: (res.icr ?? res[2]) as bigint,
      btcPrice: (res.btcPrice ?? res[3]) as bigint,
      bandUpper: (res.bandUpper ?? res[4]) as bigint,
      targetICR: (res.targetICR ?? res[5]) as bigint
    };
  }, [address]);

  const previewPremium = useCallback(async (): Promise<PremiumPreview> => {
    if (!address) throw new Error("Connect a wallet");
    const res = (await publicClient.readContract({
      address: withVault(),
      abi: vaultAbi,
      functionName: "previewPremium",
      args: [address]
    })) as any;

    return {
      active: Boolean(res.active ?? res[0]),
      musdPrice: (res.musdPrice ?? res[1]) as bigint,
      sellMusd: (res.sellMusd ?? res[2]) as bigint,
      estUsdcOut: (res.estUsdcOut ?? res[3]) as bigint,
      musdReserve: (res.musdReserve ?? res[4]) as bigint,
      usdcReserve: (res.usdcReserve ?? res[5]) as bigint
    };
  }, [address]);

  const previewDiscount = useCallback(async (): Promise<DiscountPreview> => {
    if (!address) throw new Error("Connect a wallet");
    const res = (await publicClient.readContract({
      address: withVault(),
      abi: vaultAbi,
      functionName: "previewDiscount",
      args: [address]
    })) as any;

    return {
      active: Boolean(res.active ?? res[0]),
      musdPrice: (res.musdPrice ?? res[1]) as bigint,
      spendUsdc: (res.spendUsdc ?? res[2]) as bigint,
      estMusdOut: (res.estMusdOut ?? res[3]) as bigint,
      musdReserve: (res.musdReserve ?? res[4]) as bigint,
      usdcReserve: (res.usdcReserve ?? res[5]) as bigint
    };
  }, [address]);

  const runBtcDown = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);

      const preview = await previewBtcDown();
      if (preview.triggered && preview.repayAmount > 0n) {
        const nonce = await nonceFor();
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
        const signature = (await signTypedDataAsync({
          domain: { name: "BorrowerOperationsSignatures", version: "1", chainId, verifyingContract: MEZO.borrowerOperationsSignatures },
          types: {
            RepayMUSD: [
              { name: "amount", type: "uint256" },
              { name: "borrower", type: "address" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" }
            ]
          },
          primaryType: "RepayMUSD",
          message: { amount: preview.repayAmount, borrower: address, nonce, deadline }
        })) as `0x${string}`;

        const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runBtcDown", args: [signature, deadline] });
        await publicClient.waitForTransactionReceipt({ hash });
        return;
      }

      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runBtcDown", args: ["0x", 0n] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, nonceFor, previewBtcDown, signTypedDataAsync, writeContractAsync]);

  const runBtcUp = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);

      const preview = await previewBtcUp();
      if (preview.triggered && preview.mintAmount > 0n) {
        const nonce = await nonceFor();
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
        const signature = (await signTypedDataAsync({
          domain: { name: "BorrowerOperationsSignatures", version: "1", chainId, verifyingContract: MEZO.borrowerOperationsSignatures },
          types: {
            AdjustTrove: [
              { name: "collWithdrawal", type: "uint256" },
              { name: "debtChange", type: "uint256" },
              { name: "isDebtIncrease", type: "bool" },
              { name: "assetAmount", type: "uint256" },
              { name: "borrower", type: "address" },
              { name: "recipient", type: "address" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" }
            ]
          },
          primaryType: "AdjustTrove",
          message: {
            collWithdrawal: 0n,
            debtChange: preview.mintAmount,
            isDebtIncrease: true,
            assetAmount: 0n,
            borrower: address,
            // The vault is the recipient for minted MUSD.
            recipient: withVault(),
            nonce,
            deadline
          }
        })) as `0x${string}`;

        const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runBtcUp", args: [signature, deadline] });
        await publicClient.waitForTransactionReceipt({ hash });
        return;
      }

      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runBtcUp", args: ["0x", 0n] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, nonceFor, previewBtcUp, signTypedDataAsync, writeContractAsync]);

  const runPremium = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);
      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runPremium", args: [] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, writeContractAsync]);

  const runDiscount = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);
      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runDiscount", args: [] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, writeContractAsync]);

  return { previewBtcDown, previewBtcUp, previewPremium, previewDiscount, runBtcDown, runBtcUp, runPremium, runDiscount, error };
}

