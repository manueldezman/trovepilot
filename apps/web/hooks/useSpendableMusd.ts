"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, formatUnits } from "viem";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { erc20Abi } from "@/lib/trovePilotAbis";

export function useSpendableMusd(user?: Address) {
  return useQuery({
    queryKey: ["spendableMusd", user],
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!user) throw new Error("Missing user");
      const bal = (await publicClient.readContract({
        address: MEZO.musd,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [user]
      })) as bigint;
      return { raw: bal, formatted: `${formatUnits(bal, 18)} MUSD` };
    }
  });
}
