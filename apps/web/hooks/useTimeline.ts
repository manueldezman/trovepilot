"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, formatUnits } from "viem";
import { publicClient } from "@/lib/wagmi";
import { addresses } from "@/lib/addresses";
import { mezoExplorerUrl } from "@/lib/mezo";
import { vaultAbi } from "@/lib/trovePilotAbis";

type TimelineEvent = { id: string; title: string; when: string; detail: string; txUrl?: string };

function safeStringify(value: unknown) {
  return JSON.stringify(
    value,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    0
  );
}

function fmt18(v: unknown): string {
  try {
    if (typeof v !== "bigint") return "—";
    return formatUnits(v, 18);
  } catch {
    return "—";
  }
}

function fmtAddr(v: unknown): string {
  if (typeof v !== "string") return "—";
  if (!v.startsWith("0x") || v.length < 10) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function formatDetail(eventName: string, args: any): string {
  const a = args ?? {};
  switch (eventName) {
    case "ReserveDeposited": {
      return [`Amount: ${fmt18(a.amount)} MUSD`].join("\n");
    }
    case "ReserveWithdrawn": {
      return [`Amount: ${fmt18(a.amount)} MUSD`].join("\n");
    }
    case "RulesUpdated": {
      return "Rules saved onchain.";
    }
    case "BtcDownExecuted": {
      return [
        `BTC: ${fmt18(a.btcPrice)}`,
        `ICR: ${fmt18(a.icrBefore)}x → ${fmt18(a.icrAfter)}x`,
        `Repaid: ${fmt18(a.repayAmount)} MUSD`
      ].join("\n");
    }
    case "BtcUpExecuted": {
      return [
        `BTC: ${fmt18(a.btcPrice)}`,
        `ICR: ${fmt18(a.icrBefore)}x → ${fmt18(a.icrAfter)}x`,
        `Minted: ${fmt18(a.mintAmount)} MUSD (to reserve)`
      ].join("\n");
    }
    case "PremiumRotated": {
      return [
        `MUSD price: ${fmt18(a.musdPrice)}`,
        `Sold: ${fmt18(a.sellMusd)} MUSD`,
        `USDC out (sim): ${fmt18(a.estUsdcOut)}`
      ].join("\n");
    }
    case "DiscountRotated": {
      return [
        `MUSD price: ${fmt18(a.musdPrice)}`,
        `Spent: ${fmt18(a.spendUsdc)} USDC`,
        `MUSD out (sim): ${fmt18(a.estMusdOut)}`
      ].join("\n");
    }
    default:
      return safeStringify(a);
  }
}

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
            detail: formatDetail(name, l.args ?? {}),
            txUrl
          };
        })
        .reverse();

      return { events };
    },
    select: (d) => d.events
  });
}
