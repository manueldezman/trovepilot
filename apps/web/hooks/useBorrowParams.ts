"use client";

import { useQuery } from "@tanstack/react-query";
import { publicClient } from "@/lib/wagmi";
import { MEZO } from "@/lib/mezo";
import { mezoBorrowerOperationsAbi } from "@/lib/mezoAbis";

export type BorrowParams = {
  borrowingRate: bigint; // 1e18 precision
  minNetDebt: bigint; // 1e18
};

export function useBorrowParams() {
  return useQuery({
    queryKey: ["borrowParams"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<BorrowParams> => {
      const [borrowingRate, minNetDebt] = await Promise.all([
        publicClient.readContract({ address: MEZO.borrowerOperations, abi: mezoBorrowerOperationsAbi, functionName: "borrowingRate" }),
        publicClient.readContract({ address: MEZO.borrowerOperations, abi: mezoBorrowerOperationsAbi, functionName: "minNetDebt" })
      ]);
      return { borrowingRate: borrowingRate as bigint, minNetDebt: minNetDebt as bigint };
    }
  });
}

