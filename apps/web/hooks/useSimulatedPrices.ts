"use client";

import { useQuery } from "@tanstack/react-query";
import { publicClient } from "@/lib/wagmi";
import { addresses } from "@/lib/addresses";
import { mockMarketOracleAbi } from "@/lib/trovePilotAbis";

export function useSimulatedBtcPrice() {
  return useQuery({
    queryKey: ["simBTC"],
    enabled: Boolean(addresses.mockMarketOracle),
    refetchInterval: 7_000,
    queryFn: async () => {
      const btcPrice = await publicClient.readContract({
        address: addresses.mockMarketOracle,
        abi: mockMarketOracleAbi,
        functionName: "getBTCPrice"
      });
      return { btcPrice: btcPrice as bigint };
    }
  });
}

export function useSimulatedMusdPrice() {
  return useQuery({
    queryKey: ["simMUSD"],
    enabled: Boolean(addresses.mockMarketOracle),
    refetchInterval: 7_000,
    queryFn: async () => {
      const musdPrice = await publicClient.readContract({
        address: addresses.mockMarketOracle,
        abi: mockMarketOracleAbi,
        functionName: "getMUSDPrice"
      });
      return { musdPrice: musdPrice as bigint };
    }
  });
}
