"use client";

import { useQuery } from "@tanstack/react-query";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoPriceFeedAbi } from "@/lib/mezoAbis";

export function useProtocolBtcPrice() {
  return useQuery({
    queryKey: ["protocolBtcPrice"],
    refetchInterval: 12_000,
    queryFn: async () => {
      const price = await publicClient.readContract({
        address: MEZO.priceFeed,
        abi: mezoPriceFeedAbi,
        functionName: "fetchPrice"
      });
      return price as bigint;
    }
  });
}

