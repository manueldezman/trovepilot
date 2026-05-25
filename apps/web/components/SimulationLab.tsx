"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useMounted } from "@/hooks/useMounted";
import { useSimulationActions } from "@/hooks/useSimulationActions";
import { useAutomation } from "@/hooks/useAutomation";
import { PreviewModal } from "@/components/PreviewModal";

type Scenario = "btc_down" | "btc_up" | "premium" | "discount";

export function SimulationLab() {
  const mounted = useMounted();
  const { address } = useAccount();
  const shortAddr = useMemo(() => (mounted && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null), [address, mounted]);
  const demoMode = process.env.NEXT_PUBLIC_DEMO_AUTOMATION === "1";

  const { setBtcDown, setBtcUp, setPremium103, setDiscount097, reset, error: simError } = useSimulationActions();
  const { previewBtcDown, previewBtcUp, previewPremium, previewDiscount, runBtcDown, runBtcUp, runPremium, runDiscount, error: autoError } = useAutomation();

  const [busy, setBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const [btcDownPct, setBtcDownPct] = useState(15);
  const [btcUpPct, setBtcUpPct] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function openScenario(next: Scenario, writeSim: () => Promise<void>) {
    setScenario(next);
    setModalOpen(true);
    setLoading(true);
    setPreviewErr(null);
    setPreview(null);
    setResetMsg(null);

    try {
      if (demoMode && (next === "btc_down" || next === "btc_up")) {
        if (!address) throw new Error("Connect the demo wallet first");
        const pct = next === "btc_down" ? btcDownPct : btcUpPct;
        const res = await fetch(`/api/demo/${next === "btc_down" ? "btc-down" : "btc-up"}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "preview", pct, address })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Preview failed (${res.status})`);
        const data = await res.json();
        setPreview(data.preview);
        return;
      }

      await writeSim();
      const p =
        next === "btc_down"
          ? await previewBtcDown()
          : next === "btc_up"
          ? await previewBtcUp()
          : next === "premium"
          ? await previewPremium()
          : await previewDiscount();
      setPreview(p);
    } catch (e) {
      setPreviewErr((e as Error)?.message ?? "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    await wrap(async () => {
      if (!scenario) return;
      if (demoMode && (scenario === "btc_down" || scenario === "btc_up")) {
        if (!address) throw new Error("Connect the demo wallet first");
        const res = await fetch(`/api/demo/${scenario === "btc_down" ? "btc-down" : "btc-up"}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "run", address })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Execution failed (${res.status})`);
        const data = await res.json();
        // Refresh the modal preview post-run so the user sees the final state.
        setPreview(data.previewAfter ?? data.preview);
        setModalOpen(false);
        return;
      }

      if (scenario === "btc_down") await runBtcDown();
      else if (scenario === "btc_up") await runBtcUp();
      else if (scenario === "premium") await runPremium();
      else await runDiscount();
      setModalOpen(false);
    });
  }

  const modalTitle = useMemo(() => {
    if (scenario === "btc_down") return `BTC Down (-${btcDownPct}%)`;
    if (scenario === "btc_up") return `BTC Up (+${btcUpPct}%)`;
    if (scenario === "premium") return "MUSD Premium";
    if (scenario === "discount") return "MUSD Discount";
    return "Preview";
  }, [btcDownPct, btcUpPct, scenario]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Simulation Lab</h2>
      <div style={{ marginTop: -6, color: "var(--muted)", fontSize: 13 }}>Pick a scenario, review the preview, then Confirm to execute.</div>
      {demoMode ? (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "rgba(56,189,248,0.10)", color: "rgba(15,23,42,0.85)", fontSize: 12 }}>
          Demo mode: BTC Up/Down executed by local signer.
        </div>
      ) : null}
      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>
        wallet: {shortAddr ? shortAddr : mounted ? "not connected" : "…"}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14, background: "rgba(15,23,42,0.02)" }}>
            <div style={{ fontWeight: 750, letterSpacing: -0.2 }}>BTC shocks</div>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              <PctRow label="Down" value={btcDownPct} onChange={setBtcDownPct} />
              <Btn disabled={busy} onClick={() => wrap(() => openScenario("btc_down", () => setBtcDown(btcDownPct)))}>
                Simulate BTC Down
              </Btn>

              <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />

              <PctRow label="Up" value={btcUpPct} onChange={setBtcUpPct} />
              <Btn disabled={busy} onClick={() => wrap(() => openScenario("btc_up", () => setBtcUp(btcUpPct)))}>
                Simulate BTC Up
              </Btn>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14, background: "rgba(15,23,42,0.02)" }}>
            <div style={{ fontWeight: 750, letterSpacing: -0.2 }}>Peg scenarios</div>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              <Btn disabled={busy} onClick={() => wrap(() => openScenario("premium", setPremium103))}>
                MUSD Premium ($1.03)
              </Btn>
              <Btn disabled={busy} onClick={() => wrap(() => openScenario("discount", setDiscount097))}>
                MUSD Discount ($0.97)
              </Btn>
              <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
              <Btn
                disabled={busy}
                onClick={() =>
                  wrap(async () => {
                    setResetMsg(null);
                    await reset();
                    setResetMsg("Reset complete.");
                  })
                }
              >
                Reset market
              </Btn>
            </div>
          </div>
        </div>
      </div>

      {(simError || autoError) && <div style={{ marginTop: 10, color: "var(--critical)", fontSize: 12 }}>{(simError ?? autoError)?.message}</div>}
      {resetMsg ? <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{resetMsg}</div> : null}

      <PreviewModal
        open={modalOpen}
        title={modalTitle}
        subtitle="Review the preview, then Confirm to execute."
        loading={loading}
        warning={null}
        onClose={() => setModalOpen(false)}
        onConfirm={confirm}
        confirmDisabled={!preview || Boolean(previewErr)}
      >
        {previewErr ? <div style={{ color: "var(--critical)", fontSize: 12 }}>{previewErr}</div> : null}
        {preview ? (
          <div style={{ display: "grid", gap: 8 }}>
            {scenario === "btc_down" ? (
              <BtcDownRows preview={preview} />
            ) : scenario === "btc_up" ? (
              <BtcUpRows preview={preview} />
            ) : scenario === "premium" ? (
              <PremiumRows preview={preview} />
            ) : (
              <DiscountRows preview={preview} />
            )}
          </div>
        ) : null}
      </PreviewModal>
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
        background: "rgba(15,23,42,0.04)",
        color: "var(--text)",
        textAlign: "left"
      }}
    >
      {children}
    </button>
  );
}

function PctRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--muted)", fontSize: 13 }}>{label} %</span>
      <input
        value={value}
        inputMode="numeric"
        pattern="[0-9]*"
        onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
        style={{
          width: 84,
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "rgba(15,23,42,0.03)",
          color: "var(--text)",
          fontFamily: "var(--mono)",
          textAlign: "right"
        }}
      />
    </label>
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

function BtcDownRows({ preview }: { preview: any }) {
  return (
    <>
      <Row label="Sim BTC price" value={formatUnits(preview.btcPrice as bigint, 18)} />
      <Row label="ICR" value={`${formatUnits(preview.icr as bigint, 18)}x`} />
      <Row label="Band lower" value={`${formatUnits(preview.bandLower as bigint, 18)}x`} />
      <Row label="Target ICR" value={`${formatUnits(preview.targetICR as bigint, 18)}x`} />
      <Row label="Triggered" value={preview.triggered ? "Yes" : "No"} />
      <Row label="MUSD reserve" value={`${formatUnits(preview.musdReserve as bigint, 18)} MUSD`} />
      {preview.triggered ? (
        <>
          <Row label="Repay amount" value={`${formatUnits(preview.repayAmount as bigint, 18)} MUSD`} />
          <Row label="Signature required" value={(preview.repayAmount as bigint) > 0n ? "Yes" : "No"} />
        </>
      ) : null}
    </>
  );
}

function BtcUpRows({ preview }: { preview: any }) {
  return (
    <>
      <Row label="Sim BTC price" value={formatUnits(preview.btcPrice as bigint, 18)} />
      <Row label="ICR" value={`${formatUnits(preview.icr as bigint, 18)}x`} />
      <Row label="Band upper" value={`${formatUnits(preview.bandUpper as bigint, 18)}x`} />
      <Row label="Target ICR" value={`${formatUnits(preview.targetICR as bigint, 18)}x`} />
      <Row label="Triggered" value={preview.triggered ? "Yes" : "No"} />
      {preview.triggered ? (
        <>
          <Row label="Mint amount (to reserve)" value={`${formatUnits(preview.mintAmount as bigint, 18)} MUSD`} />
          <Row label="Signature required" value={(preview.mintAmount as bigint) > 0n ? "Yes" : "No"} />
        </>
      ) : null}
    </>
  );
}

function PremiumRows({ preview }: { preview: any }) {
  return (
    <>
      <Row label="Sim MUSD price" value={formatUnits(preview.musdPrice as bigint, 18)} />
      <Row label="Active" value={preview.active ? "Yes" : "No"} />
      <Row label="Sell MUSD" value={`${formatUnits(preview.sellMusd as bigint, 18)} MUSD`} />
      <Row label="Est. USDC out" value={`${formatUnits(preview.estUsdcOut as bigint, 18)} USDC`} />
      <Row label="MUSD reserve" value={`${formatUnits(preview.musdReserve as bigint, 18)} MUSD`} />
      <Row label="USDC reserve" value={`${formatUnits(preview.usdcReserve as bigint, 18)} USDC`} />
    </>
  );
}

function DiscountRows({ preview }: { preview: any }) {
  return (
    <>
      <Row label="Sim MUSD price" value={formatUnits(preview.musdPrice as bigint, 18)} />
      <Row label="Active" value={preview.active ? "Yes" : "No"} />
      <Row label="Spend USDC" value={`${formatUnits(preview.spendUsdc as bigint, 18)} USDC`} />
      <Row label="Est. MUSD out" value={`${formatUnits(preview.estMusdOut as bigint, 18)} MUSD`} />
      <Row label="MUSD reserve" value={`${formatUnits(preview.musdReserve as bigint, 18)} MUSD`} />
      <Row label="USDC reserve" value={`${formatUnits(preview.usdcReserve as bigint, 18)} USDC`} />
    </>
  );
}
