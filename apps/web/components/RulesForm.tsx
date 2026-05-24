"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { useRules } from "@/hooks/useRules";

const defaults = {
  minICR: "1.40",
  repayBps: "1000",
  premiumThreshold: "1.02",
  discountThreshold: "0.98",
  maxReserveUseBps: "2500",
  collateralDefenseEnabled: true,
  premiumModeEnabled: true,
  discountModeEnabled: true
};

export function RulesForm() {
  const { rules, setRules, isPending, error } = useRules();
  const [form, setForm] = useState(defaults);

  useEffect(() => {
    if (!rules) return;
    setForm({
      minICR: rules.minICR,
      repayBps: rules.repayBps,
      premiumThreshold: rules.premiumThreshold,
      discountThreshold: rules.discountThreshold,
      maxReserveUseBps: rules.maxReserveUseBps,
      collateralDefenseEnabled: rules.collateralDefenseEnabled,
      premiumModeEnabled: rules.premiumModeEnabled,
      discountModeEnabled: rules.discountModeEnabled
    });
  }, [rules]);

  const payload = useMemo(() => {
    return {
      minICR: parseUnits(form.minICR || "0", 18),
      repayBps: BigInt(form.repayBps || "0"),
      premiumThreshold: parseUnits(form.premiumThreshold || "0", 18),
      discountThreshold: parseUnits(form.discountThreshold || "0", 18),
      maxReserveUseBps: BigInt(form.maxReserveUseBps || "0"),
      collateralDefenseEnabled: form.collateralDefenseEnabled,
      premiumModeEnabled: form.premiumModeEnabled,
      discountModeEnabled: form.discountModeEnabled
    };
  }, [form]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Strategy Rules</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Minimum ICR (e.g. 1.40)" value={form.minICR} onChange={(v) => setForm((f) => ({ ...f, minICR: v }))} />
        <Field label="Repay bps (e.g. 1000 = 10%)" value={form.repayBps} onChange={(v) => setForm((f) => ({ ...f, repayBps: v }))} />
        <Field label="Premium trigger (e.g. 1.02)" value={form.premiumThreshold} onChange={(v) => setForm((f) => ({ ...f, premiumThreshold: v }))} />
        <Field label="Discount trigger (e.g. 0.98)" value={form.discountThreshold} onChange={(v) => setForm((f) => ({ ...f, discountThreshold: v }))} />
        <Field label="Max reserve use bps (e.g. 2500 = 25%)" value={form.maxReserveUseBps} onChange={(v) => setForm((f) => ({ ...f, maxReserveUseBps: v }))} />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Toggle label="Collateral defense" checked={form.collateralDefenseEnabled} onChange={(v) => setForm((f) => ({ ...f, collateralDefenseEnabled: v }))} />
        <Toggle label="Premium mode" checked={form.premiumModeEnabled} onChange={(v) => setForm((f) => ({ ...f, premiumModeEnabled: v }))} />
        <Toggle label="Discount mode" checked={form.discountModeEnabled} onChange={(v) => setForm((f) => ({ ...f, discountModeEnabled: v }))} />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button
          disabled={isPending}
          onClick={() => setRules(payload)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(124,58,237,0.25)",
            color: "var(--text)"
          }}
        >
          {isPending ? "Saving…" : "Save rules onchain"}
        </button>
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ color: "var(--muted)" }}>{label}</span>
    </label>
  );
}
