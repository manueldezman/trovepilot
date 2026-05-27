"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoTroveManagerAbi } from "@/lib/mezoAbis";

export type TroveStatus = {
  status: bigint;
  isActive: boolean;
};

export function useTroveStatus(user?: Address) {
  return useQuery({
    queryKey: ["troveStatus", user],
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<TroveStatus> => {
      if (!user) throw new Error("Missing user");
      const status = (await publicClient.readContract({
        address: MEZO.troveManager,
        abi: mezoTroveManagerAbi,
        functionName: "getTroveStatus",
        args: [user]
      })) as bigint;
      return { status, isActive: status === 1n };
    }
  });
}
