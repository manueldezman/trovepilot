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
    case "RiskStateEvaluated": {
      return [
        `ICR: ${fmt18(a.icr)}x`,
        `Safety triggered: ${a.safetyTriggered ? "Yes" : "No"}`
      ].join("\n");
    }
    case "SafetyRepayExecuted": {
      return [
        `Repaid: ${fmt18(a.repayAmount)} MUSD`,
        `ICR: ${fmt18(a.icrBefore)}x → ${fmt18(a.icrAfter)}x`
      ].join("\n");
    }
    case "PremiumSimulated": {
      return [
        `MUSD price: ${fmt18(a.musdPrice)}`,
        `Notional: ${fmt18(a.notional)} MUSD`,
        `Est. gain: ${fmt18(a.estGain)} MUSD`
      ].join("\n");
    }
    case "DiscountSimulated": {
      return [
        `MUSD price: ${fmt18(a.musdPrice)}`,
        `Spend: ${fmt18(a.spend)} MUSD`,
        `MUSD acquired: ${fmt18(a.musdAcquired)} MUSD`,
        `Est. savings: ${fmt18(a.estSavings)} MUSD`
      ].join("\n");
    }
    case "AutomationRan": {
      return [
        `BTC: ${fmt18(a.btcPrice)} | MUSD: ${fmt18(a.musdPrice)}`,
        `ICR: ${fmt18(a.icrBefore)}x → ${fmt18(a.icrAfter)}x`,
        `Safety reserve: ${fmt18(a.safetyBefore)} → ${fmt18(a.safetyAfter)}`,
        `Opp reserve: ${fmt18(a.oppBefore)} → ${fmt18(a.oppAfter)}`,
        `Mask: ${typeof a.mask === "bigint" ? a.mask.toString() : String(a.mask ?? "0")}`
      ].join("\n");
    }
    case "ReserveDeposited": {
      return [`Token: ${fmtAddr(a.token)}`, `Amount: ${fmt18(a.amount)} MUSD`].join("\n");
    }
    case "ReserveWithdrawn": {
      return [`Token: ${fmtAddr(a.token)}`, `Amount: ${fmt18(a.amount)} MUSD`].join("\n");
    }
    case "RulesUpdated": {
      return "Rules saved onchain.";
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
