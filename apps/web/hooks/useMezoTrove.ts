"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, formatUnits } from "viem";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoTroveManagerAbi } from "@/lib/mezoAbis";
import { useSimulatedMarket } from "@/hooks/useSimulatedMarket";
import { formatUnitsCeil } from "@/lib/format";

export function useMezoTrove(user?: Address) {
  const { data: sim } = useSimulatedMarket(user);
  const btcPrice = sim?.btcPrice;

  return useQuery({
    queryKey: ["mezoTrove", user, btcPrice?.toString() ?? "none"],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) throw new Error("Missing user");

      const [coll, debt, status] = await Promise.all([
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [user] }),
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [user] }),
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveStatus", args: [user] })
      ]);

      const statusNum = Number(status);
      const isActive = statusNum === 1;
      const statusLabel = isActive ? "Active" : "No active trove";

      const debtRaw = debt as bigint;
      const collRaw = coll as bigint;

      // If the trove isn't active (or debt is zero), Mezo's `getCurrentICR` can return `uint256.max`,
      // which renders as a huge number. Only compute ICR when we have an active trove + nonzero debt
      // + a known BTC price.
      let icrRaw: bigint | null = null;
      if (isActive && debtRaw > 0n && btcPrice) {
        const icr = await publicClient.readContract({
          address: MEZO.troveManager,
          abi: mezoTroveManagerAbi,
          functionName: "getCurrentICR",
          args: [user, btcPrice]
        });
        icrRaw = icr as bigint;
      }

      return {
        collateralRaw: collRaw,
        debtRaw,
        icrRaw,
        collateral: `${formatUnitsCeil(collRaw, 18, 2)} BTC`,
        debt: `${formatUnitsCeil(debtRaw, 18, 2)} MUSD`,
        icr: icrRaw ? `${formatUnitsCeil(icrRaw, 18, 2)}x` : "—",
        statusLabel
      };
    }
  });
}
