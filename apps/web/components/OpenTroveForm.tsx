"use client";

import { useMemo, useState } from "react";
import { parseEther, parseUnits } from "viem";
import { useOpenTrove } from "@/hooks/useOpenTrove";

export function OpenTroveForm() {
  const [btc, setBtc] = useState("0.01");
  const [musd, setMusd] = useState("2000");

  const btcValue = useMemo(() => {
    try {
      return parseEther(btc || "0");
    } catch {
      return 0n;
    }
  }, [btc]);

  const debt = useMemo(() => {
    try {
      return parseUnits(musd || "0", 18);
    } catch {
      return 0n;
    }
  }, [musd]);

  const { openTrove, isPending, error, txUrl } = useOpenTrove();

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Open Trove (BTC → mint MUSD)</h2>
      <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
        This mints real MUSD by opening a Mezo trove via <code>BorrowerOperations.openTrove</code>. For MVP, we pass empty hints (0x0, 0x0).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
        <Field label="BTC collateral (native)" value={btc} onChange={setBtc} />
        <Field label="MUSD to mint" value={musd} onChange={setMusd} />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          disabled={isPending || btcValue <= 0n || debt <= 0n}
          onClick={() => openTrove({ collateralValue: btcValue, debtAmount: debt })}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(124,58,237,0.25)",
            color: "var(--text)"
          }}
        >
          {isPending ? "Submitting…" : "Open trove + mint MUSD"}
        </button>
        {txUrl ? (
          <a href={txUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: "var(--muted)", fontSize: 13 }}>
            View transaction
          </a>
        ) : null}
      </div>

      {error ? <div style={{ marginTop: 10, color: "#fda4af", fontSize: 12 }}>{error.message}</div> : null}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "var(--muted)", fontSize: 13 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.03)",
          color: "var(--text)"
        }}
      />
    </label>
  );
}

