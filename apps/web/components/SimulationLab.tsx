"use client";

import { useState } from "react";
import { useSimulationActions } from "@/hooks/useSimulationActions";
import { useExecuteActions } from "@/hooks/useExecuteActions";

export function SimulationLab() {
  const [busy, setBusy] = useState(false);
  const { setBtcDrop15, setPremium103, setDiscount097, reset, error: simError } = useSimulationActions();
  const { runCollateralDefense, runPremium, runDiscount, error: execError } = useExecuteActions();

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Simulation Lab</h2>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn disabled={busy} onClick={() => wrap(setBtcDrop15)}>
            BTC drops 15%
          </Btn>
          <Btn disabled={busy} onClick={() => wrap(setPremium103)}>
            MUSD premium ($1.03)
          </Btn>
          <Btn disabled={busy} onClick={() => wrap(setDiscount097)}>
            MUSD discount ($0.97)
          </Btn>
          <Btn disabled={busy} onClick={() => wrap(reset)}>
            Reset market
          </Btn>
        </div>

        <div style={{ marginTop: 6, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", marginBottom: 10 }}>Run TrovePilot</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn disabled={busy} onClick={() => wrap(runCollateralDefense)}>
              Collateral defense (real repay)
            </Btn>
            <Btn disabled={busy} onClick={() => wrap(runPremium)}>
              Premium response (sim)
            </Btn>
            <Btn disabled={busy} onClick={() => wrap(runDiscount)}>
              Discount response (sim)
            </Btn>
          </div>
        </div>
      </div>

      {(simError || execError) && <div style={{ marginTop: 10, color: "#fda4af", fontSize: 12 }}>{(simError ?? execError)?.message}</div>}
    </section>
  );
}

function Btn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.03)",
        color: "var(--text)"
      }}
    >
      {children}
    </button>
  );
}
