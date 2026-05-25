"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useMounted } from "@/hooks/useMounted";
import { useSimulationActions } from "@/hooks/useSimulationActions";
import { useAutomation } from "@/hooks/useAutomation";
import { PreviewModal } from "@/components/PreviewModal";

type Scenario = "btc_drop" | "premium" | "discount";

export function SimulationLab() {
  const mounted = useMounted();
  const { address } = useAccount();
  const shortAddr = useMemo(() => (mounted && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null), [address, mounted]);

  const { setBtcDrop15, setPremium103, setDiscount097, reset, error: simError } = useSimulationActions();
  const { previewSafety, previewPeg, runSafety, runPeg, error: autoError } = useAutomation();

  const [busy, setBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

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
      await writeSim(); // writes per-user sim state onchain
      const p = next === "btc_drop" ? await previewSafety() : await previewPeg();
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
      if (scenario === "btc_drop") await runSafety();
      else await runPeg();
      setModalOpen(false);
    });
  }

  const modalTitle = useMemo(() => {
    if (scenario === "btc_drop") return "BTC Shock (-15%)";
    if (scenario === "premium") return "MUSD Premium";
    if (scenario === "discount") return "MUSD Discount";
    return "Preview";
  }, [scenario]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Simulation Lab</h2>
      <div style={{ marginTop: -6, color: "var(--muted)", fontSize: 13 }}>Pick a scenario, review the preview, then Confirm to execute.</div>
      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>
        wallet: {shortAddr ? shortAddr : mounted ? "not connected" : "…"}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn disabled={busy} onClick={() => wrap(() => openScenario("btc_drop", setBtcDrop15))}>
            BTC drops 15%
          </Btn>
          <Btn disabled={busy} onClick={() => wrap(() => openScenario("premium", setPremium103))}>
            MUSD premium ($1.03)
          </Btn>
          <Btn disabled={busy} onClick={() => wrap(() => openScenario("discount", setDiscount097))}>
            MUSD discount ($0.97)
          </Btn>
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

      {(simError || autoError) && <div style={{ marginTop: 10, color: "var(--critical)", fontSize: 12 }}>{(simError ?? autoError)?.message}</div>}
      {resetMsg ? <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{resetMsg}</div> : null}

      <PreviewModal
        open={modalOpen}
        title={modalTitle}
        subtitle="Review the scenario preview, then Confirm to execute."
        loading={loading}
        warning={null}
        onClose={() => setModalOpen(false)}
        onConfirm={confirm}
        confirmDisabled={!preview || Boolean(previewErr)}
      >
        {previewErr ? <div style={{ color: "var(--critical)", fontSize: 12 }}>{previewErr}</div> : null}
        {preview ? (
          <div style={{ display: "grid", gap: 8 }}>
            {scenario === "btc_drop" ? <SafetyPreviewRows preview={preview} /> : scenario === "premium" ? <PremiumPreviewRows preview={preview} /> : <DiscountPreviewRows preview={preview} />}
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
        color: "var(--text)"
      }}
    >
      {children}
    </button>
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

function SafetyPreviewRows({ preview }: { preview: any }) {
  return (
    <>
      <Row label="Sim BTC price" value={formatUnits(preview.btcPrice as bigint, 18)} />
      <Row label="ICR" value={`${formatUnits(preview.icr as bigint, 18)}x`} />
      <Row label="Safety ICR" value={`${formatUnits(preview.safetyICR as bigint, 18)}x`} />
      <Row label="Safety triggered" value={preview.triggered ? "Yes" : "No"} />
      <Row label="Safety reserve" value={`${formatUnits(preview.safetyReserveBalance as bigint, 18)} MUSD`} />
      {preview.triggered ? (
        <>
          <Row label="Repay amount" value={`${formatUnits(preview.repayAmount as bigint, 18)} MUSD`} />
          <Row label="Signature required" value={(preview.repayAmount as bigint) > 0n ? "Yes" : "No"} />
        </>
      ) : null}
    </>
  );
}

function PremiumPreviewRows({ preview }: { preview: any }) {
  return (
    <>
      <Row label="Sim MUSD price" value={formatUnits(preview.musdPrice as bigint, 18)} />
      <Row label="Premium threshold" value={formatUnits(preview.premiumThreshold as bigint, 18)} />
      <Row label="Premium active" value={preview.premiumActive ? "Yes" : "No"} />
      <Row label="Opportunity reserve" value={`${formatUnits(preview.opportunityReserveBalance as bigint, 18)} MUSD`} />
      <Row label="Estimated gain" value={`${formatUnits(preview.estGain as bigint, 18)} MUSD`} />
    </>
  );
}

function DiscountPreviewRows({ preview }: { preview: any }) {
  return (
    <>
      <Row label="Sim MUSD price" value={formatUnits(preview.musdPrice as bigint, 18)} />
      <Row label="Discount threshold" value={formatUnits(preview.discountThreshold as bigint, 18)} />
      <Row label="Discount active" value={preview.discountActive ? "Yes" : "No"} />
      <Row label="Opportunity reserve" value={`${formatUnits(preview.opportunityReserveBalance as bigint, 18)} MUSD`} />
      <Row label="Estimated savings" value={`${formatUnits(preview.estSavings as bigint, 18)} MUSD`} />
    </>
  );
}

