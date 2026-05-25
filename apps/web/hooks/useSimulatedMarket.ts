"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { publicClient } from "@/lib/wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";

export function useSimulatedMarket(user?: Address) {
  return useQuery({
    queryKey: ["simMarket", user],
    enabled: Boolean(user && addresses.vault),
    refetchInterval: 7_000,
    queryFn: async () => {
      if (!user) throw new Error("Missing user");
      if (!addresses.vault) throw new Error("Missing vault address");

      const res = (await publicClient.readContract({
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "previewAutomation",
        args: [user]
      })) as any;

      return {
        btcPrice: (res.btcPrice ?? res[3]) as bigint,
        musdPrice: (res.musdPrice ?? res[4]) as bigint
      };
    }
  });
}

