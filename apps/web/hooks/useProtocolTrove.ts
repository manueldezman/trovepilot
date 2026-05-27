"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoTroveManagerAbi } from "@/lib/mezoAbis";

export type ProtocolTrove = {
  collateral: bigint;
  debt: bigint;
  icr: bigint;
  status: bigint;
  maxBorrowingCapacity: bigint;
};

export function useProtocolTrove(user?: Address, price?: bigint) {
  return useQuery({
    queryKey: ["protocolTrove", user, price?.toString() ?? "none"],
    enabled: Boolean(user && price),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<ProtocolTrove> => {
      if (!user) throw new Error("Missing user");
      if (!price) throw new Error("Missing price");
      const [collateral, debt, status, icr, maxBorrowingCapacity] = await Promise.all([
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [user] }) as Promise<bigint>,
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [user] }) as Promise<bigint>,
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveStatus", args: [user] }) as Promise<bigint>,
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getCurrentICR", args: [user, price] }) as Promise<bigint>,
        publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveMaxBorrowingCapacity", args: [user] }) as Promise<bigint>
      ]);

      return { collateral, debt, status, icr, maxBorrowingCapacity };
    }
  });
}
