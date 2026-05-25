"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";

export type RulesPayload = {
  targetICR: bigint;
  bandLowerICR: bigint;
  bandUpperICR: bigint;
  premiumThreshold: bigint;
  discountThreshold: bigint;
  premiumSellBps: bigint;
  discountBuyBps: bigint;
  btcDownEnabled: boolean;
  btcUpEnabled: boolean;
  premiumEnabled: boolean;
  discountEnabled: boolean;
};

export function useRules() {
  const { address } = useAccount();
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const { data } = useReadContract({
    address: addresses.vault ?? undefined,
    abi: vaultAbi,
    functionName: "getRules",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && addresses.vault) }
  });

  const rules = useMemo(() => {
    if (!data) return null;
    const r = data as any;
    const raw = {
      targetICR: (r.targetICR ?? r[0] ?? 0n) as bigint,
      bandLowerICR: (r.bandLowerICR ?? r[1] ?? 0n) as bigint,
      bandUpperICR: (r.bandUpperICR ?? r[2] ?? 0n) as bigint,
      premiumThreshold: (r.premiumThreshold ?? r[3] ?? 0n) as bigint,
      discountThreshold: (r.discountThreshold ?? r[4] ?? 0n) as bigint,
      premiumSellBps: (r.premiumSellBps ?? r[5] ?? 0n) as bigint,
      discountBuyBps: (r.discountBuyBps ?? r[6] ?? 0n) as bigint,
      btcDownEnabled: Boolean(r.btcDownEnabled ?? r[7]),
      btcUpEnabled: Boolean(r.btcUpEnabled ?? r[8]),
      premiumEnabled: Boolean(r.premiumEnabled ?? r[9]),
      discountEnabled: Boolean(r.discountEnabled ?? r[10])
    };

    const looksUnset =
      raw.targetICR === 0n &&
      raw.bandLowerICR === 0n &&
      raw.bandUpperICR === 0n &&
      raw.premiumThreshold === 0n &&
      raw.discountThreshold === 0n &&
      raw.premiumSellBps === 0n &&
      raw.discountBuyBps === 0n &&
      raw.btcDownEnabled === false &&
      raw.btcUpEnabled === false &&
      raw.premiumEnabled === false &&
      raw.discountEnabled === false;

    if (looksUnset) return null;

    return {
      targetICR: formatUnits(raw.targetICR, 18),
      bandLowerICR: formatUnits(raw.bandLowerICR, 18),
      bandUpperICR: formatUnits(raw.bandUpperICR, 18),
      premiumThreshold: formatUnits(raw.premiumThreshold, 18),
      discountThreshold: formatUnits(raw.discountThreshold, 18),
      premiumSellBps: bpsToPercentString(raw.premiumSellBps),
      discountBuyBps: bpsToPercentString(raw.discountBuyBps),
      btcDownEnabled: raw.btcDownEnabled,
      btcUpEnabled: raw.btcUpEnabled,
      premiumEnabled: raw.premiumEnabled,
      discountEnabled: raw.discountEnabled
    };
  }, [data]);

  const setRules = useCallback(
    async (payload: RulesPayload) => {
      setError(null);
      if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");
      setIsPending(true);
      try {
        await writeContractAsync({ address: addresses.vault, abi: vaultAbi, functionName: "setRules", args: [payload] });
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [writeContractAsync]
  );

  return { rules, setRules, isPending, error };
}

function bpsToPercentString(bps: bigint): string {
  const sign = bps < 0n ? "-" : "";
  const v = bps < 0n ? -bps : bps;
  const whole = v / 100n;
  const frac = v % 100n;
  if (frac === 0n) return `${sign}${whole.toString()}`;
  const frac2 = frac.toString().padStart(2, "0").replace(/0+$/, "");
  return `${sign}${whole.toString()}.${frac2}`;
}

