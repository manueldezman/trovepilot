"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useMounted } from "@/hooks/useMounted";
import { useVaultState } from "@/hooks/useVaultState";
import { useSimulatedMarket } from "@/hooks/useSimulatedMarket";
import { formatUnitsCeil } from "@/lib/format";

const ONE = 10n ** 18n;

export function ReserveCompositionCard() {
  const mounted = useMounted();
  const { address } = useAccount();
  const user = mounted ? address : undefined;
  const { data: vault } = useVaultState(user);
  const { data: market } = useSimulatedMarket(user);

  const stats = useMemo(() => {
    const musd = (vault as any)?.musdReserveRaw ?? 0n;
    const usdc = (vault as any)?.usdcReserveRaw ?? 0n;
    const price = market?.musdPrice ?? ONE;
    const musdValue = (musd * price) / ONE;
    const usdcValue = usdc;
    const total = musdValue + usdcValue;
    const musdPct = total > 0n ? Number((musdValue * 10000n) / total) / 100 : 0;
    const status = musdPct >= 55 && musdPct <= 65 ? "Balanced" : "Rebalancing";
    return { musd, usdc, musdPct, status, price };
  }, [market?.musdPrice, vault]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 750, letterSpacing: -0.2 }}>Reserve Composition</div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>{stats.status}</div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <Row label="Stability Liquidity" value={`${formatUnitsCeil(stats.musd, 18, 2)} MUSD`} />
        <Row label="Opportunity Liquidity" value={`${formatUnitsCeil(stats.usdc, 18, 2)} USDC`} />
        <Row label="Target ratio" value="60% / 40%" />
        <Row label="Current ratio" value={`${stats.musdPct.toFixed(2)}% MUSD`} />
      </div>

      <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
        Value basis uses simulated MUSD price: <span style={{ fontFamily: "var(--mono)" }}>{formatUnits(stats.price, 18)}</span>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)" }}>{value}</div>
    </div>
  );
}
