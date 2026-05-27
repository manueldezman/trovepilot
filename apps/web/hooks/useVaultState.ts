"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { publicClient } from "@/lib/wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { formatUnitsCeil } from "@/lib/format";

export function useVaultState(user?: Address) {
  return useQuery({
    queryKey: ["vaultState", user],
    enabled: Boolean(user && addresses.vault),
    queryFn: async () => {
      if (!user) throw new Error("Missing user");
      if (!addresses.vault) throw new Error("Missing vault address");

      const [musd, usdc, rules] = await Promise.all([
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getMusdReserve", args: [user] }),
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getUsdcReserve", args: [user] }),
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getRules", args: [user] })
      ]);

      const r = rules as any;
      const rulesSet = Boolean(
        r &&
          ((r.targetICR ?? 0n) > 0n ||
            r.btcDownEnabled ||
            r.btcUpEnabled ||
            r.premiumEnabled ||
            r.discountEnabled)
      );

      return {
        musdReserveRaw: musd as bigint,
        usdcReserveRaw: usdc as bigint,
        musdReserve: `${formatUnitsCeil(musd as bigint, 18, 2)} MUSD`,
        usdcReserve: `${formatUnitsCeil(usdc as bigint, 18, 2)} MUSD`,
        rulesSet
      };
    }
  });
}
