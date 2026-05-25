"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useSignTypedData, useWalletClient, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { MEZO, mezoChainId } from "@/lib/mezo";
import { mezoBorrowerOperationsSignaturesAbi } from "@/lib/mezoAbis";
import { computeAdjustTroveDigest, computeRepayMusdDigest } from "@/lib/borrowerOpsSignatures";

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
  const { data: walletClient } = useWalletClient();
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
        if (!walletClient) throw new Error("Wallet client unavailable");
        const nonce = await nonceFor();
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
        // Mezo's BorrowerOperationsSignatures uses a non-standard EIP-712 struct hash (abi.encodePacked),
        // so `signTypedData` will not match. We must sign the exact digest it computes via `eth_sign`.
        const digest = computeRepayMusdDigest({
          amount: preview.repayAmount,
          borrower: address,
          nonce,
          deadline,
          chainId,
          verifyingContract: MEZO.borrowerOperationsSignatures
        });
        const signature = (await walletClient.request({
          method: "eth_sign",
          params: [address, digest]
        })) as `0x${string}`;

        // Preflight simulation to surface revert reasons (instead of MetaMask "network fee" generic errors).
        try {
          await publicClient.simulateContract({
            account: address,
            address: withVault(),
            abi: vaultAbi,
            functionName: "runBtcDown",
            args: [signature, deadline]
          });
        } catch (e) {
          const err: any = e;
          const msg = err?.shortMessage || err?.reason || err?.message || "Simulation failed";
          throw new Error(`BTC Down repay would fail: ${msg}`);
        }

        const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runBtcDown", args: [signature, deadline] });
        await publicClient.waitForTransactionReceipt({ hash });
        return;
      }

      try {
        await publicClient.simulateContract({
          account: address,
          address: withVault(),
          abi: vaultAbi,
          functionName: "runBtcDown",
          args: ["0x", 0n]
        });
      } catch (e) {
        const err: any = e;
        const msg = err?.shortMessage || err?.reason || err?.message || "Simulation failed";
        throw new Error(`BTC Down would fail: ${msg}`);
      }

      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runBtcDown", args: ["0x", 0n] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, nonceFor, previewBtcDown, walletClient, writeContractAsync]);

  const runBtcUp = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);

      const preview = await previewBtcUp();
      if (preview.triggered && preview.mintAmount > 0n) {
        if (!walletClient) throw new Error("Wallet client unavailable");
        const nonce = await nonceFor();
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
        const digest = computeAdjustTroveDigest({
          collWithdrawal: 0n,
          debtChange: preview.mintAmount,
          isDebtIncrease: true,
          assetAmount: 0n,
          borrower: address,
          recipient: withVault(),
          nonce,
          deadline,
          chainId,
          verifyingContract: MEZO.borrowerOperationsSignatures
        });
        const signature = (await walletClient.request({
          method: "eth_sign",
          params: [address, digest]
        })) as `0x${string}`;

        try {
          await publicClient.simulateContract({
            account: address,
            address: withVault(),
            abi: vaultAbi,
            functionName: "runBtcUp",
            args: [signature, deadline]
          });
        } catch (e) {
          const err: any = e;
          const msg = err?.shortMessage || err?.reason || err?.message || "Simulation failed";
          throw new Error(`BTC Up mint would fail: ${msg}`);
        }

        const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runBtcUp", args: [signature, deadline] });
        await publicClient.waitForTransactionReceipt({ hash });
        return;
      }

      try {
        await publicClient.simulateContract({
          account: address,
          address: withVault(),
          abi: vaultAbi,
          functionName: "runBtcUp",
          args: ["0x", 0n]
        });
      } catch (e) {
        const err: any = e;
        const msg = err?.shortMessage || err?.reason || err?.message || "Simulation failed";
        throw new Error(`BTC Up would fail: ${msg}`);
      }

      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runBtcUp", args: ["0x", 0n] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, [address, chainId, nonceFor, previewBtcUp, walletClient, writeContractAsync]);

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
