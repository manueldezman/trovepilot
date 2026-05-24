"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, formatUnits } from "viem";
import { publicClient } from "@/lib/wagmi";
import { addresses } from "@/lib/addresses";
import { MEZO } from "@/lib/mezo";
import { vaultAbi } from "@/lib/trovePilotAbis";

export function useVaultState(user?: Address) {
  return useQuery({
    queryKey: ["vaultState", user],
    enabled: Boolean(user && addresses.vault),
    queryFn: async () => {
      if (!user) throw new Error("Missing user");

      const [reserve, rules] = await Promise.all([
        publicClient.readContract({
          address: addresses.vault,
          abi: vaultAbi,
          functionName: "getReserveBalance",
          args: [user, MEZO.musd]
        }),
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getRules", args: [user] })
      ]);

      const rulesArr = rules as readonly unknown[];
      const rulesSet = Boolean(rulesArr?.length);

      return {
        musdReserve: `${formatUnits(reserve as bigint, 18)} MUSD`,
        rulesSet
      };
    }
  });
}
