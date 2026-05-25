"use client";

import { useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { useMounted } from "@/hooks/useMounted";
import { useMezoTrove } from "@/hooks/useMezoTrove";
import { useSimulatedMarket } from "@/hooks/useSimulatedMarket";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";

const ONE = 10n ** 18n;

function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function mulDiv(a: bigint, b: bigint, d: bigint) {
  return (a * b) / d;
}

export function IcrHealthCard() {
  const mounted = useMounted();
  const { address } = useAccount();
  const safeAddress = mounted ? address : undefined;
  const { data: sim } = useSimulatedMarket(safeAddress);
  const { data: trove, isLoading: troveLoading } = useMezoTrove(safeAddress);

  const { data: onchainRules } = useReadContract({
    address: addresses.vault ?? undefined,
    abi: vaultAbi,
    functionName: "getRules",
    args: safeAddress ? [safeAddress] : undefined,
    query: { enabled: Boolean(safeAddress && addresses.vault) }
  });

  const safetyICR = useMemo(() => {
    const r = onchainRules as any;
    const v = (r?.safetyICR ?? r?.[0]) as bigint | undefined;
    return v && v > 0n ? v : 1_500_000_000_000_000_000n; // 1.50e18 default
  }, [onchainRules]);

  const icr = trove?.icrRaw ?? null;
  const status = useMemo(() => {
    if (!icr) return { label: "—", tone: "muted" as const };
    if (icr < safetyICR) return { label: "CRITICAL", tone: "critical" as const };
    // Early warning band just above the safety threshold.
    if (icr < mulDiv(safetyICR, 115n, 100n)) return { label: "WARNING", tone: "warn" as const };
    return { label: "SAFE", tone: "safe" as const };
  }, [icr, safetyICR]);

  const pct = useMemo(() => {
    if (!icr) return 0.0;
    // Map ICR range [1.0 .. 2.5] to [0..1] for the gauge.
    const x = Number(icr) / 1e18;
    return clamp01((x - 1.0) / (2.5 - 1.0));
  }, [icr]);

  const toneColor = status.tone === "critical" ? "var(--critical)" : status.tone === "warn" ? "var(--warn)" : status.tone === "safe" ? "var(--safe)" : "var(--muted)";
  const ring = `conic-gradient(${toneColor} ${Math.round(pct * 360)}deg, rgba(148,163,184,0.12) 0deg)`;

  return (
    <section
      style={{
        padding: 18,
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "var(--panel)",
        boxShadow: "var(--shadow2)",
        height: "100%"
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", letterSpacing: 0.2 }}>Position Health</div>
          <div style={{ fontSize: 34, letterSpacing: -0.6, fontWeight: 760, lineHeight: 1 }}>
            {icr ? formatUnits(icr, 18) : troveLoading ? "…" : "—"}
            <span style={{ fontSize: 16, color: "var(--muted)", marginLeft: 6 }}>ICR</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: status.tone === "critical" ? "var(--criticalSoft)" : "rgba(15,23,42,0.04)",
                color: toneColor,
                fontWeight: 700,
                letterSpacing: 0.4,
                fontSize: 12
              }}
            >
              {status.label}
            </span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              sim BTC: {sim?.btcPrice ? formatUnits(sim.btcPrice, 18) : "—"} • safety ICR: {formatUnits(safetyICR, 18)}
            </span>
          </div>
        </div>

        <div
          aria-label="ICR gauge"
          style={{
            width: 86,
            height: 86,
            borderRadius: 999,
            background: ring,
            display: "grid",
            placeItems: "center",
            border: "1px solid var(--border)"
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: 999,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              display: "grid",
              placeItems: "center"
            }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{Math.round(pct * 100)}%</div>
          </div>
        </div>
      </div>
    </section>
  );
}
