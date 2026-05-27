"use client";

import { useAccount } from "wagmi";
import { useVaultState } from "@/hooks/useVaultState";
import { DepositWithdraw } from "@/components/DepositWithdraw";
import { useMounted } from "@/hooks/useMounted";

export function VaultOverview({ showActions = false }: { showActions?: boolean }) {
  const mounted = useMounted();
  const { address } = useAccount();
  const safeAddress = mounted ? address : undefined;
  const { data, isLoading, isFetching, error, refetch } = useVaultState(safeAddress);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>TrovePilot Vault</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh balances"
            aria-label="Refresh balances"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              display: "grid",
              placeItems: "center"
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: isFetching ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }}
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6l3 2" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6l-3-2" />
            </svg>
          </button>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{isLoading || isFetching ? "Refreshing…" : null}</div>
        </div>
      </div>

      {!safeAddress ? <p style={{ color: "var(--muted)" }}>Connect a wallet to load your vault state.</p> : null}
      {error ? <p style={{ color: "#fda4af" }}>{error.message}</p> : null}

      {data ? (
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <Row label="Stability Liquidity (MUSD)" value={data.musdReserve} />
          <Row label="Opportunity Liquidity (placeholder)" value={(data as any).usdcReserve ?? "—"} />
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
