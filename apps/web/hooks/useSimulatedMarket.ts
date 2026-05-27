"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { publicClient } from "@/lib/wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { MEZO } from "@/lib/mezo";
import { mezoPriceFeedAbi } from "@/lib/mezoAbis";

const ONE = 10n ** 18n;

export function useSimulatedMarket(user?: Address) {
  return useQuery({
    queryKey: ["simMarketV3", user],
    enabled: Boolean(user && addresses.vault),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!user) throw new Error("Missing user");
      if (!addresses.vault) throw new Error("Missing vault address");

      const [simBtc, simMusd, protocolBtc] = await Promise.all([
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getSimulatedBTCPrice", args: [user] }) as Promise<bigint>,
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getSimulatedMUSDPrice", args: [user] }) as Promise<bigint>,
        publicClient.readContract({ address: MEZO.priceFeed, abi: mezoPriceFeedAbi, functionName: "fetchPrice" }) as Promise<bigint>
      ]);

      return {
        btcPrice: simBtc > 0n ? simBtc : protocolBtc,
        musdPrice: simMusd > 0n ? simMusd : ONE
      };
    }
  });
}
