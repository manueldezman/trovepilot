"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useSimulationActions } from "@/hooks/useSimulationActions";
import { useAutomation } from "@/hooks/useAutomation";
import { useMounted } from "@/hooks/useMounted";
import { publicClient } from "@/lib/wagmi";
import { addresses } from "@/lib/addresses";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { PreviewModal } from "@/components/PreviewModal";

type Scenario = "btc_drop" | "premium" | "discount" | "reset" | "manual";

export function SimulationLab() {
  const [busy, setBusy] = useState(false);
  const { setBtcDrop15, setPremium103, setDiscount097, reset, error: simError } = useSimulationActions();
  const { runAutomation, previewAutomation, error: autoError } = useAutomation();

  const mounted = useMounted();
  const { address } = useAccount();
  const safeAddress = mounted ? address : undefined;

  const [modalOpen, setModalOpen] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [oppReserve, setOppReserve] = useState<bigint | null>(null);
  const [rules, setRules] = useState<any>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  const shortAddr = useMemo(() => {
    if (!safeAddress) return null;
    return `${safeAddress.slice(0, 6)}…${safeAddress.slice(-4)}`;
  }, [safeAddress]);

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview(opts: { needOpp?: boolean; needRules?: boolean } = {}) {
    if (!safeAddress) throw new Error("Connect a wallet");
    if (!addresses.vault) throw new Error("Missing vault address (set NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)");

    const p = await previewAutomation();
    setPreview(p);

    if (opts.needOpp) {
      const opp = (await publicClient.readContract({
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "getOpportunityReserve",
        args: [safeAddress]
      })) as bigint;
      setOppReserve(opp);
    } else {
      setOppReserve(null);
    }

    if (opts.needRules) {
      const r = (await publicClient.readContract({
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "getRules",
        args: [safeAddress]
      })) as any;
      setRules(r);
    } else {
      setRules(null);
    }
  }

  async function openModalForScenario(nextScenario: Scenario, simFn?: () => Promise<void>) {
    setScenario(nextScenario);
    setModalOpen(true);
    setLoading(true);
    setPreviewErr(null);
    setPreview(null);
    setOppReserve(null);
    setRules(null);

    try {
      if (simFn) await simFn(); // writes per-user sim state onchain
      const needOpp = nextScenario === "premium" || nextScenario === "discount" || nextScenario === "reset" || nextScenario === "manual";
      const needRules = true;
      await loadPreview({ needOpp, needRules });
    } catch (e) {
      setPreviewErr((e as Error)?.message ?? "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    await wrap(async () => {
      await runAutomation();
      const needOpp = scenario === "premium" || scenario === "discount" || scenario === "reset" || scenario === "manual";
      await loadPreview({ needOpp, needRules: true });
      setModalOpen(false);
    });
  }

  const modalTitle = useMemo(() => {
    switch (scenario) {
      case "btc_drop":
        return "BTC Shock (-15%)";
      case "premium":
        return "MUSD Premium";
      case "discount":
        return "MUSD Discount";
      case "reset":
        return "Reset Market";
      case "manual":
        return "Run Automation";
      default:
        return "Preview";
    }
  }, [scenario]);

  const suppressionWarning = useMemo(() => {
    if (!preview) return null;
    if (!preview.needsSafetyRepay) return null;
    if (scenario === "premium" || scenario === "discount") {
      return "Safety overrides opportunity; peg actions will be skipped this run.";
    }
    return null;
  }, [preview, scenario]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Simulation Lab</h2>
      <div style={{ marginTop: -6, color: "var(--muted)", fontSize: 13 }}>Pick a scenario to preview impact. Confirm to run automation.</div>
      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>
        wallet: {shortAddr ? shortAddr : mounted ? "not connected" : "…"}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn disabled={busy} onClick={() => wrap(() => openModalForScenario("btc_drop", setBtcDrop15))}>
            BTC drops 15%
          </Btn>
          <Btn disabled={busy} onClick={() => wrap(() => openModalForScenario("premium", setPremium103))}>
            MUSD premium ($1.03)
          </Btn>
          <Btn disabled={busy} onClick={() => wrap(() => openModalForScenario("discount", setDiscount097))}>
            MUSD discount ($0.97)
          </Btn>
          <Btn disabled={busy} onClick={() => wrap(() => openModalForScenario("reset", reset))}>
            Reset market
          </Btn>
        </div>

        <div style={{ marginTop: 6, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", marginBottom: 10 }}>Manual</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn disabled={busy} onClick={() => wrap(() => openModalForScenario("manual"))}>
              Run Automation
            </Btn>
          </div>
        </div>
      </div>

      {(simError || autoError) && <div style={{ marginTop: 10, color: "var(--critical)", fontSize: 12 }}>{(simError ?? autoError)?.message}</div>}

      <PreviewModal
        open={modalOpen}
        title={modalTitle}
        subtitle="Review the scenario preview, then Confirm to run automation."
        loading={loading}
        warning={suppressionWarning}
        onClose={() => setModalOpen(false)}
        onConfirm={confirm}
        confirmDisabled={!preview || Boolean(previewErr)}
      >
        {previewErr ? <div style={{ color: "var(--critical)", fontSize: 12 }}>{previewErr}</div> : null}
        {preview ? (
          <div style={{ display: "grid", gap: 8 }}>
            {scenario === "premium" ? (
              <PremiumPreview preview={preview} oppReserve={oppReserve} rules={rules} />
            ) : scenario === "discount" ? (
              <DiscountPreview preview={preview} oppReserve={oppReserve} rules={rules} />
            ) : scenario === "btc_drop" ? (
              <BtcDropPreview preview={preview} rules={rules} />
            ) : (
              <FullSnapshotPreview preview={preview} oppReserve={oppReserve} rules={rules} />
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

function estimatePremiumGain(opportunityReserve: bigint, musdPrice: bigint): bigint {
  if (musdPrice <= 1_000_000_000_000_000_000n) return 0n;
  return (opportunityReserve * (musdPrice - 1_000_000_000_000_000_000n)) / 1_000_000_000_000_000_000n;
}

function estimateDiscountSavings(opportunityReserve: bigint, musdPrice: bigint): bigint {
  if (musdPrice <= 0n) return 0n;
  const acquired = (opportunityReserve * 1_000_000_000_000_000_000n) / musdPrice;
  return acquired > opportunityReserve ? acquired - opportunityReserve : 0n;
}

function asBigint(v: any, fallback = 0n): bigint {
  try {
    if (typeof v === "bigint") return v;
    return fallback;
  } catch {
    return fallback;
  }
}

function BtcDropPreview({ preview, rules }: { preview: any; rules: any }) {
  const safetyICR = asBigint(rules?.safetyICR ?? rules?.[0], 0n);
  return (
    <>
      <Row label="Sim BTC price" value={formatUnits(preview.btcPrice as bigint, 18)} />
      <Row label="ICR" value={`${formatUnits(preview.icr as bigint, 18)}x`} />
      <Row label="Safety ICR" value={safetyICR > 0n ? `${formatUnits(safetyICR, 18)}x` : "—"} />
      <Row label="Safety triggered" value={preview.needsSafetyRepay ? "Yes" : "No"} />
      {preview.needsSafetyRepay ? (
        <>
          <Row label="Repay amount" value={`${formatUnits(preview.repayAmount as bigint, 18)} MUSD`} />
          <Row label="Signature required" value={(preview.repayAmount as bigint) > 0n ? "Yes" : "No"} />
          {(preview.repayAmount as bigint) === 0n ? (
            <div style={{ color: "var(--warn)", fontSize: 12 }}>
              Repay amount is 0. Ensure you deposited into Safety reserve and set Repay % / Max reserve use % &gt; 0.
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function PremiumPreview({ preview, oppReserve, rules }: { preview: any; oppReserve: bigint | null; rules: any }) {
  const premiumThreshold = asBigint(rules?.premiumThreshold ?? rules?.[2], 0n);
  const reserve = oppReserve ?? 0n;
  return (
    <>
      <Row label="Sim MUSD price" value={formatUnits(preview.musdPrice as bigint, 18)} />
      <Row label="Premium threshold" value={premiumThreshold > 0n ? formatUnits(premiumThreshold, 18) : "—"} />
      <Row label="Premium active" value={preview.premiumActive ? "Yes" : "No"} />
      <Row label="Opportunity reserve" value={oppReserve == null ? "—" : `${formatUnits(reserve, 18)} MUSD`} />
      {oppReserve != null ? <Row label="Est. gain" value={`${formatUnits(estimatePremiumGain(reserve, preview.musdPrice as bigint), 18)} MUSD`} /> : null}
    </>
  );
}

function DiscountPreview({ preview, oppReserve, rules }: { preview: any; oppReserve: bigint | null; rules: any }) {
  const discountThreshold = asBigint(rules?.discountThreshold ?? rules?.[3], 0n);
  const reserve = oppReserve ?? 0n;
  return (
    <>
      <Row label="Sim MUSD price" value={formatUnits(preview.musdPrice as bigint, 18)} />
      <Row label="Discount threshold" value={discountThreshold > 0n ? formatUnits(discountThreshold, 18) : "—"} />
      <Row label="Discount active" value={preview.discountActive ? "Yes" : "No"} />
      <Row label="Opportunity reserve" value={oppReserve == null ? "—" : `${formatUnits(reserve, 18)} MUSD`} />
      {oppReserve != null ? <Row label="Est. savings" value={`${formatUnits(estimateDiscountSavings(reserve, preview.musdPrice as bigint), 18)} MUSD`} /> : null}
    </>
  );
}

function FullSnapshotPreview({ preview, oppReserve, rules }: { preview: any; oppReserve: bigint | null; rules: any }) {
  const safetyICR = asBigint(rules?.safetyICR ?? rules?.[0], 0n);
  const premiumThreshold = asBigint(rules?.premiumThreshold ?? rules?.[2], 0n);
  const discountThreshold = asBigint(rules?.discountThreshold ?? rules?.[3], 0n);
  const reserve = oppReserve ?? 0n;

  return (
    <>
      <Row label="Sim BTC price" value={formatUnits(preview.btcPrice as bigint, 18)} />
      <Row label="Sim MUSD price" value={formatUnits(preview.musdPrice as bigint, 18)} />
      <Row label="ICR" value={`${formatUnits(preview.icr as bigint, 18)}x`} />
      <Row label="Safety ICR" value={safetyICR > 0n ? `${formatUnits(safetyICR, 18)}x` : "—"} />
      <Row label="Safety triggered" value={preview.needsSafetyRepay ? "Yes" : "No"} />
      <Row label="Repay amount" value={`${formatUnits(preview.repayAmount as bigint, 18)} MUSD`} />
      <Row label="Signature required" value={(preview.repayAmount as bigint) > 0n && preview.needsSafetyRepay ? "Yes" : "No"} />

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", display: "grid", gap: 8 }}>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>Peg</div>
        <Row label="Premium threshold" value={premiumThreshold > 0n ? formatUnits(premiumThreshold, 18) : "—"} />
        <Row label="Discount threshold" value={discountThreshold > 0n ? formatUnits(discountThreshold, 18) : "—"} />
        <Row label="Opportunity reserve" value={oppReserve == null ? "—" : `${formatUnits(reserve, 18)} MUSD`} />
        <Row label="Premium active" value={preview.premiumActive ? "Yes" : "No"} />
        <Row label="Discount active" value={preview.discountActive ? "Yes" : "No"} />
        {oppReserve != null ? (
          <>
            <Row label="Est. premium gain" value={`${formatUnits(estimatePremiumGain(reserve, preview.musdPrice as bigint), 18)} MUSD`} />
            <Row label="Est. discount savings" value={`${formatUnits(estimateDiscountSavings(reserve, preview.musdPrice as bigint), 18)} MUSD`} />
          </>
        ) : null}
      </div>
    </>
  );
}

