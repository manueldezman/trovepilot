"use client";

import { useState } from "react";
import { useSimulationActions } from "@/hooks/useSimulationActions";
import { useAutomation } from "@/hooks/useAutomation";

export function SimulationLab() {
  const [busy, setBusy] = useState(false);
  const { setBtcDrop15, setPremium103, setDiscount097, reset, error: simError } = useSimulationActions();
  const { runAutomation, error: autoError } = useAutomation();

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
          <Btn
            disabled={busy}
            onClick={() =>
              wrap(async () => {
                await setBtcDrop15();
                await runAutomation();
              })
            }
          >
            BTC drops 15%
          </Btn>
          <Btn
            disabled={busy}
            onClick={() =>
              wrap(async () => {
                await setPremium103();
                await runAutomation();
              })
            }
          >
            MUSD premium ($1.03)
          </Btn>
          <Btn
            disabled={busy}
            onClick={() =>
              wrap(async () => {
                await setDiscount097();
                await runAutomation();
              })
            }
          >
            MUSD discount ($0.97)
          </Btn>
          <Btn
            disabled={busy}
            onClick={() =>
              wrap(async () => {
                await reset();
                await runAutomation();
              })
            }
          >
            Reset market
          </Btn>
        </div>

        <div style={{ marginTop: 6, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", marginBottom: 10 }}>Manual</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn disabled={busy} onClick={() => wrap(runAutomation)}>
              Run Automation
            </Btn>
          </div>
        </div>
      </div>

      {(simError || autoError) && <div style={{ marginTop: 10, color: "#fda4af", fontSize: 12 }}>{(simError ?? autoError)?.message}</div>}
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
