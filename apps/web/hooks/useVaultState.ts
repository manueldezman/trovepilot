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
      if (!addresses.vault) throw new Error("Missing vault address");

      const [reserve, rules] = await Promise.all([
        publicClient.readContract({
          address: addresses.vault,
          abi: vaultAbi,
          functionName: "getReserveBalance",
          args: [user, MEZO.musd]
        }),
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getRules", args: [user] })
      ]);

      const r = rules as any;
      const rulesSet = Boolean(r && ((r.safetyICR ?? 0n) > 0n || r.safetyEnabled || r.premiumEnabled || r.discountEnabled));

      const [safety, opp, acquired] = await Promise.all([
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getSafetyReserve", args: [user] }),
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getOpportunityReserve", args: [user] }),
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getOpportunityMusdAcquired", args: [user] })
      ]);

      return {
        musdReserve: `${formatUnits(reserve as bigint, 18)} MUSD`,
        safetyReserve: `${formatUnits(safety as bigint, 18)} MUSD`,
        opportunityReserve: `${formatUnits(opp as bigint, 18)} MUSD`,
        opportunityMusdAcquired: `${formatUnits(acquired as bigint, 18)} MUSD`,
        rulesSet
      };
    }
  });
}
