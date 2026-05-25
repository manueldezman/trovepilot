"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useMounted } from "@/hooks/useMounted";
import { useVaultState } from "@/hooks/useVaultState";
import { useSpendableMusd } from "@/hooks/useSpendableMusd";
import { useProtocolBtcPrice } from "@/hooks/useProtocolBtcPrice";
import { useProtocolTrove } from "@/hooks/useProtocolTrove";

export function LiquidCoverageCard() {
  const mounted = useMounted();
  const { address } = useAccount();
  const safeAddress = mounted ? address : undefined;

  const { data: spendable } = useSpendableMusd(safeAddress);
  const { data: vault } = useVaultState(safeAddress);
  const { data: protocolPrice } = useProtocolBtcPrice();
  const { data: trove } = useProtocolTrove(safeAddress, protocolPrice);

  const coverage = useMemo(() => {
    const spend = spendable?.raw ?? 0n;
    const musdReserveRaw = (vault as any)?.musdReserveRaw ?? 0n;
    const usdcReserveRaw = (vault as any)?.usdcReserveRaw ?? 0n;
    const debt = trove?.status === 1n ? trove.debt : 0n;
    return spend + musdReserveRaw + usdcReserveRaw - debt;
  }, [spendable?.raw, trove?.debt, trove?.status, vault]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)", height: "100%" }}>
      <div style={{ fontWeight: 750, letterSpacing: -0.2 }}>Liquid Balances − Debt</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 780, letterSpacing: -0.4, lineHeight: 1.1 }}>
        {formatUnits(coverage, 18)}
      </div>
      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
        (Spendable MUSD + MUSD Reserve + USDC Reserve) − Trove Debt
      </div>
    </section>
  );
}
