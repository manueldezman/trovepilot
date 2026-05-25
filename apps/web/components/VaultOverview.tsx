"use client";

import { useAccount } from "wagmi";
import { useVaultState } from "@/hooks/useVaultState";
import { DepositWithdraw } from "@/components/DepositWithdraw";
import { useMounted } from "@/hooks/useMounted";

export function VaultOverview({ showActions = false }: { showActions?: boolean }) {
  const mounted = useMounted();
  const { address } = useAccount();
  const safeAddress = mounted ? address : undefined;
  const { data, isLoading, error } = useVaultState(safeAddress);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>TrovePilot Vault</h2>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{isLoading ? "Loading…" : null}</div>
      </div>

      {!safeAddress ? <p style={{ color: "var(--muted)" }}>Connect a wallet to load your vault state.</p> : null}
      {error ? <p style={{ color: "#fda4af" }}>{error.message}</p> : null}

      {data ? (
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <Row label="Total reserve" value={data.musdReserve} />
          <Row label="Safety reserve" value={data.safetyReserve} />
          <Row label="Opportunity reserve" value={data.opportunityReserve} />
          <Row label="MUSD acquired (sim)" value={data.opportunityMusdAcquired} />
          <Row label="Rules set" value={data.rulesSet ? "Yes" : "No"} />
          {showActions ? <DepositWithdraw /> : null}
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
