"use client";

import { useAccount } from "wagmi";
import { useMezoTrove } from "@/hooks/useMezoTrove";

export function TroveOverview() {
  const { address } = useAccount();
  const { data, isLoading, error } = useMezoTrove(address);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Mezo Trove</h2>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{isLoading ? "Loading…" : null}</div>
      </div>

      {!address ? <p style={{ color: "var(--muted)" }}>Connect a wallet to load your trove.</p> : null}
      {error ? <p style={{ color: "#fda4af" }}>{error.message}</p> : null}

      {data ? (
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <Row label="Status" value={data.statusLabel} />
          <Row label="Collateral" value={data.collateral} />
          <Row label="Debt" value={data.debt} />
          <Row label="ICR (sim BTC price)" value={data.icr} />
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
        {value}
      </div>
    </div>
  );
}
