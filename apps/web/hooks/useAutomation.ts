"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { addresses } from "@/lib/addresses";
import { erc20Abi, vaultAbi } from "@/lib/trovePilotAbis";
import { publicClient } from "@/lib/wagmi";
import { MEZO, mezoChainId } from "@/lib/mezo";
import {
  mezoBorrowerOperationsAbi,
  mezoHintHelpersAbi,
  mezoSortedTrovesAbi,
  mezoTroveManagerAbi
} from "@/lib/mezoAbis";
import { notifyError } from "@/lib/notify";

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
  mintAmount: bigint; // clamped
  mintAmountRaw: bigint; // from vault preview (unclamped)
  maxMintAllowed: bigint; // derived from Mezo max borrowing capacity headroom
  cappedByCapacity: boolean;
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
  const [error, setError] = useState<Error | null>(null);

  const withVault = () => {
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
    return addresses.vault;
  };

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

    const triggered = Boolean(res.triggered ?? res[0]);
    const mintAmountRaw = (res.mintAmount ?? res[1]) as bigint;
    const icr = (res.icr ?? res[2]) as bigint;
    const btcPrice = (res.btcPrice ?? res[3]) as bigint;
    const bandUpper = (res.bandUpper ?? res[4]) as bigint;
    const targetICR = (res.targetICR ?? res[5]) as bigint;

    let maxMintAllowed = 0n;
    let mintAmount = mintAmountRaw;
    let cappedByCapacity = false;

    // Capacity clamp: prevent proposing a mint larger than Mezo allows.
    if (triggered && mintAmountRaw > 0n) {
      const [debtComposite, capComposite, rate] = (await Promise.all([
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [address] }),
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveMaxBorrowingCapacity", args: [address] }),
        publicClient.readContract({ address: MEZO.borrowerOperations, abi: mezoBorrowerOperationsAbi, functionName: "borrowingRate", args: [] })
      ])) as [bigint, bigint, bigint];

      const headroom = capComposite > debtComposite ? capComposite - debtComposite : 0n;
      maxMintAllowed = (headroom * 1_000_000_000_000_000_000n) / (1_000_000_000_000_000_000n + rate);
      if (maxMintAllowed > 0n) maxMintAllowed -= 1n; // small buffer for rounding

      if (mintAmountRaw > maxMintAllowed) {
        mintAmount = maxMintAllowed;
        cappedByCapacity = true;
      }
    }

    return {
      triggered,
      mintAmount,
      mintAmountRaw,
      maxMintAllowed,
      cappedByCapacity,
      icr,
      btcPrice,
      bandUpper,
      targetICR
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
        // Production-safe repay flow (no eth_sign):
        // 1) Withdraw needed MUSD from vault reserve to the borrower's wallet.
        // 2) Repay from the borrower's wallet via BorrowerOperations.repayMUSD.
        const withdrawHash = await writeContractAsync({
          address: withVault(),
          abi: vaultAbi,
          functionName: "withdrawReserveMUSD",
          args: [preview.repayAmount]
        });
        await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

        const [coll, debt] = (await Promise.all([
          publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [address] }),
          publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [address] })
        ])) as [bigint, bigint];

        const newDebt = debt - preview.repayAmount;
        const nicr = (await publicClient.readContract({
          address: MEZO.hintHelpers,
          abi: mezoHintHelpersAbi,
          functionName: "computeNominalCR",
          args: [coll, newDebt]
        })) as bigint;

        const seed = BigInt(Date.now());
        const approx = (await publicClient.readContract({
          address: MEZO.hintHelpers,
          abi: mezoHintHelpersAbi,
          functionName: "getApproxHint",
          args: [nicr, 50n, seed]
        })) as any;
        const hintAddress = (approx.hintAddress ?? approx[0]) as `0x${string}`;

        const pos = (await publicClient.readContract({
          address: MEZO.sortedTroves,
          abi: mezoSortedTrovesAbi,
          functionName: "findInsertPosition",
          args: [nicr, hintAddress, hintAddress]
        })) as any;
        const upperHint = (pos.prevId ?? pos[0]) as `0x${string}`;
        const lowerHint = (pos.nextId ?? pos[1]) as `0x${string}`;

        // Preflight repay to surface revert reasons (instead of MetaMask "network fee" generic errors).
        try {
          await publicClient.simulateContract({
            account: address,
            address: MEZO.borrowerOperations,
            abi: mezoBorrowerOperationsAbi,
            functionName: "repayMUSD",
            args: [preview.repayAmount, upperHint, lowerHint]
          });
        } catch (e) {
          const err: any = e;
          const msg = err?.shortMessage || err?.reason || err?.message || "Simulation failed";
          throw new Error(`Repay would fail: ${msg}`);
        }

        const repayHash = await writeContractAsync({
          address: MEZO.borrowerOperations,
          abi: mezoBorrowerOperationsAbi,
          functionName: "repayMUSD",
          args: [preview.repayAmount, upperHint, lowerHint]
        });
        await publicClient.waitForTransactionReceipt({ hash: repayHash });
        return;
      }
      if (!preview.triggered) {
        throw new Error("BTC Down not triggered for current simulated state");
      }
      if (preview.repayAmount <= 0n) {
        throw new Error("No repay amount available");
      }
    } catch (e) {
      const err = e as Error;
      setError(err);
      notifyError(err.message);
      throw e;
    }
  }, [address, chainId, previewBtcDown, writeContractAsync]);

  const runBtcUp = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);

      const preview = await previewBtcUp();
      if (preview.triggered && preview.mintAmount > 0n) {
        if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");

        const [coll, debt, rate] = (await Promise.all([
          publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [address] }),
          publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [address] }),
          publicClient.readContract({ address: MEZO.borrowerOperations, abi: mezoBorrowerOperationsAbi, functionName: "borrowingRate", args: [] })
        ])) as [bigint, bigint, bigint];

        const fee = (preview.mintAmount * rate) / 1_000_000_000_000_000_000n;
        const newDebt = debt + preview.mintAmount + fee;
        const nicr = (await publicClient.readContract({
          address: MEZO.hintHelpers,
          abi: mezoHintHelpersAbi,
          functionName: "computeNominalCR",
          args: [coll, newDebt]
        })) as bigint;

        const seed = BigInt(Date.now());
        const approx = (await publicClient.readContract({
          address: MEZO.hintHelpers,
          abi: mezoHintHelpersAbi,
          functionName: "getApproxHint",
          args: [nicr, 50n, seed]
        })) as any;
        const hintAddress = (approx.hintAddress ?? approx[0]) as `0x${string}`;

        const pos = (await publicClient.readContract({
          address: MEZO.sortedTroves,
          abi: mezoSortedTrovesAbi,
          functionName: "findInsertPosition",
          args: [nicr, hintAddress, hintAddress]
        })) as any;
        const upperHint = (pos.prevId ?? pos[0]) as `0x${string}`;
        const lowerHint = (pos.nextId ?? pos[1]) as `0x${string}`;

        try {
          await publicClient.simulateContract({
            account: address,
            address: MEZO.borrowerOperations,
            abi: mezoBorrowerOperationsAbi,
            functionName: "withdrawMUSD",
            args: [preview.mintAmount, upperHint, lowerHint]
          });
        } catch (e) {
          const err: any = e;
          const msg = err?.shortMessage || err?.reason || err?.message || "Simulation failed";
          throw new Error(`Mint would fail: ${msg}`);
        }

        const mintHash = await writeContractAsync({
          address: MEZO.borrowerOperations,
          abi: mezoBorrowerOperationsAbi,
          functionName: "withdrawMUSD",
          args: [preview.mintAmount, upperHint, lowerHint]
        });
        await publicClient.waitForTransactionReceipt({ hash: mintHash });

        await writeContractAsync({ address: MEZO.musd, abi: erc20Abi, functionName: "approve", args: [addresses.vault, preview.mintAmount] });
        const depositHash = await writeContractAsync({ address: addresses.vault, abi: vaultAbi, functionName: "depositReserveMUSD", args: [preview.mintAmount] });
        await publicClient.waitForTransactionReceipt({ hash: depositHash });
        return;
      }

      if (preview.triggered && preview.mintAmount === 0n) {
        throw new Error("No borrowing capacity remaining");
      }
      if (!preview.triggered) {
        throw new Error("BTC Up not triggered for current simulated state");
      }
    } catch (e) {
      const err = e as Error;
      setError(err);
      notifyError(err.message);
      throw e;
    }
  }, [address, chainId, previewBtcUp, writeContractAsync]);

  const runPremium = useCallback(async () => {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (chainId !== mezoChainId) throw new Error(`Wrong network (expected chainId ${mezoChainId})`);
      const hash = await writeContractAsync({ address: withVault(), abi: vaultAbi, functionName: "runPremium", args: [] });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      const err = e as Error;
      setError(err);
      notifyError(err.message);
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
      const err = e as Error;
      setError(err);
      notifyError(err.message);
      throw e;
    }
  }, [address, chainId, writeContractAsync]);

  return { previewBtcDown, previewBtcUp, previewPremium, previewDiscount, runBtcDown, runBtcUp, runPremium, runDiscount, error };
}
