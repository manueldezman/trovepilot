"use client";

import { useMemo, useState } from "react";
import { formatUnits, parseEther } from "viem";
import { useOpenTrove } from "@/hooks/useOpenTrove";
import { useProtocolBtcPrice } from "@/hooks/useProtocolBtcPrice";
import { useBorrowParams } from "@/hooks/useBorrowParams";

const GAS_COMP = 200n * 10n ** 18n;
const MIN_MINTED = 2000n * 10n ** 18n;
const ONE = 10n ** 18n;

export function OpenTroveForm() {
  const [btc, setBtc] = useState("0.01");
  const [icrPct, setIcrPct] = useState(140);

  const btcValue = useMemo(() => {
    try {
      return parseEther(btc || "0");
    } catch {
      return 0n;
    }
  }, [btc]);

  const { data: protocolPrice, isLoading: priceLoading, error: priceError } = useProtocolBtcPrice();
  const { data: borrowParams, isLoading: paramsLoading, error: paramsError } = useBorrowParams();

  const calc = useMemo(() => {
    if (!protocolPrice || !borrowParams) return null;

    const targetICR = (BigInt(icrPct) * ONE) / 100n;
    if (targetICR <= 0n) return null;

    const compositeDebt = (btcValue * protocolPrice) / targetICR;
    if (compositeDebt <= GAS_COMP) {
      return {
        targetICR,
        compositeDebt,
        netDebt: 0n,
        debtAmount: 0n,
        fee: 0n,
        reasons: ["Collateral too low for chosen ICR"]
      };
    }

    const netDebt = compositeDebt - GAS_COMP;
    const borrowingRate = borrowParams.borrowingRate; // 1e18
    const debtAmount = (netDebt * ONE) / (ONE + borrowingRate);
    const fee = netDebt > debtAmount ? netDebt - debtAmount : 0n;

    const reasons: string[] = [];
    if (debtAmount < MIN_MINTED) reasons.push("Minimum borrow is 2000 MUSD");
    if (netDebt < borrowParams.minNetDebt) reasons.push(`Below Mezo minNetDebt (${formatUnits(borrowParams.minNetDebt, 18)} MUSD)`);

    return { targetICR, compositeDebt, netDebt, debtAmount, fee, reasons };
  }, [borrowParams, btcValue, icrPct, protocolPrice]);

  const { openTrove, isPending, error, txUrl } = useOpenTrove();

  const disabled = isPending || btcValue <= 0n || !calc || calc.debtAmount <= 0n || calc.reasons.length > 0;

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Open Trove (BTC → mint MUSD)</h2>
      <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
        This mints real MUSD by opening a Mezo trove via <code>BorrowerOperations.openTrove</code>, using Mezo&apos;s onchain BTC price (
        <code>PriceFeed.fetchPrice()</code>). For MVP, we pass empty hints (0x0, 0x0).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
        <Field label="BTC collateral (native)" value={btc} onChange={setBtc} />
        <div style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Target collateralization ratio (ICR)</span>
          <input
            type="range"
            min={110}
            max={250}
            step={1}
            value={icrPct}
            onChange={(e) => setIcrPct(Number(e.target.value))}
          />
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12 }}>
            <span>110%</span>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {icrPct}%
            </span>
            <span>250%</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <Row label="Protocol BTC price" value={priceLoading ? "Loading…" : priceError ? "Error" : protocolPrice ? formatUnits(protocolPrice, 18) : "—"} />
        <Row label="Borrowing rate" value={paramsLoading ? "Loading…" : paramsError ? "Error" : borrowParams ? `${formatUnits(borrowParams.borrowingRate, 18)} (1e18)` : "—"} />
        <Row label="Estimated minted MUSD" value={calc ? `${formatUnits(calc.debtAmount, 18)} MUSD` : "—"} />
        <Row label="Estimated borrowing fee" value={calc ? `${formatUnits(calc.fee, 18)} MUSD` : "—"} />
        <Row label="Gas compensation" value="200.0 MUSD" />
        <Row label="Net debt" value={calc ? `${formatUnits(calc.netDebt, 18)} MUSD` : "—"} />
        <Row label="Composite debt" value={calc ? `${formatUnits(calc.compositeDebt, 18)} MUSD` : "—"} />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          disabled={disabled}
          onClick={() => openTrove({ collateralValue: btcValue, debtAmount: calc!.debtAmount })}
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

      {calc && calc.reasons.length > 0 ? (
        <div style={{ marginTop: 10, color: "#fbbf24", fontSize: 12 }}>
          {calc.reasons.join(" • ")}
        </div>
      ) : null}
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
