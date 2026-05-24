"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { publicClient } from "@/lib/wagmi";
import { addresses } from "@/lib/addresses";
import { mezoExplorerUrl } from "@/lib/mezo";
import { vaultAbi } from "@/lib/trovePilotAbis";

type TimelineEvent = { id: string; title: string; when: string; detail: string; txUrl?: string };

export function useTimeline(user?: Address) {
  return useQuery({
    queryKey: ["timeline", user],
    enabled: Boolean(user && addresses.vault),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!user) return { events: [] as TimelineEvent[] };

      const latest = await publicClient.getBlockNumber();
      const from = latest > 1500n ? latest - 1500n : 0n;

      const logs = await publicClient.getLogs({
        address: addresses.vault,
        events: vaultAbi.filter((x: any) => x.type === "event"),
        fromBlock: from,
        toBlock: "latest"
      } as any);

      const events: TimelineEvent[] = logs
        .map((l: any) => {
          const name = l.eventName ?? "Event";
          const when = `#${l.blockNumber?.toString?.() ?? "?"}`;
          const txUrl = mezoExplorerUrl ? `${mezoExplorerUrl}/tx/${l.transactionHash}` : undefined;
          return {
            id: `${l.transactionHash}-${l.logIndex}`,
            title: name,
            when,
            detail: JSON.stringify(l.args ?? {}),
            txUrl
          };
        })
        .reverse();

      return { events };
    },
    select: (d) => d.events
  });
}
