"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, formatUnits } from "viem";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoTroveManagerAbi } from "@/lib/mezoAbis";
import { useSimulatedMarket } from "@/hooks/useSimulatedMarket";

export function useMezoTrove(user?: Address) {
  const { data: sim } = useSimulatedMarket(user);
  const btcPrice = sim?.btcPrice;

  return useQuery({
    queryKey: ["mezoTrove", user, btcPrice?.toString() ?? "none"],
    enabled: Boolean(user && btcPrice),
    queryFn: async () => {
      if (!user) throw new Error("Missing user");
      if (!btcPrice) throw new Error("Missing simulated BTC price");

      const [coll, debt, status] = await Promise.all([
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [user] }),
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [user] }),
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveStatus", args: [user] })
      ]);

      const icr = await publicClient.readContract({
        address: MEZO.troveManager,
        abi: mezoTroveManagerAbi,
        functionName: "getCurrentICR",
        args: [user, btcPrice]
      });

      const statusNum = Number(status);
      const statusLabel = statusNum === 1 ? "Active" : statusNum === 2 ? "Closed" : `Status ${statusNum}`;

      return {
        collateralRaw: coll as bigint,
        debtRaw: debt as bigint,
        icrRaw: icr as bigint,
        collateral: `${formatUnits(coll as bigint, 18)} BTC`,
        debt: `${formatUnits(debt as bigint, 18)} MUSD`,
        icr: `${formatUnits(icr as bigint, 18)}x`,
        statusLabel
      };
    }
  });
}
