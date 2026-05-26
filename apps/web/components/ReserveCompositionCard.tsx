"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useMounted } from "@/hooks/useMounted";
import { useVaultState } from "@/hooks/useVaultState";
import { formatUnitsCeil } from "@/lib/format";

const ONE = 10n ** 18n;

export function ReserveCompositionCard() {
  const mounted = useMounted();
  const { address } = useAccount();
  const user = mounted ? address : undefined;
  const { data: vault } = useVaultState(user);
  const stats = useMemo(() => {
    const musd = (vault as any)?.musdReserveRaw ?? 0n;
    const usdc = (vault as any)?.usdcReserveRaw ?? 0n;
    // In VaultV5, "Opportunity Liquidity" is a withdrawable placeholder lane backed by MUSD.
    // Treat both lanes as MUSD units for ratio display.
    const total = musd + usdc;
    const musdPct = total > 0n ? Number((musd * 10000n) / total) / 100 : 0;
    const status = musdPct >= 55 && musdPct <= 65 ? "Balanced" : "Rebalancing";
    return { musd, usdc, musdPct, status };
  }, [vault]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 750, letterSpacing: -0.2 }}>Reserve Composition</div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>{stats.status}</div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <Row label="Stability Liquidity" value={`${formatUnitsCeil(stats.musd, 18, 2)} MUSD`} />
        <Row label="Opportunity Liquidity" value={`${formatUnitsCeil(stats.usdc, 18, 2)} MUSD`} />
        <Row label="Target ratio" value="60% / 40%" />
        <Row label="Current ratio" value={`${stats.musdPct.toFixed(2)}% MUSD`} />
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
