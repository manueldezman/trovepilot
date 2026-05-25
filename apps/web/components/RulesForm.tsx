"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { useRules } from "@/hooks/useRules";

const defaults = {
  safetyICR: "1.50",
  repayBps: "1000",
  premiumThreshold: "1.02",
  discountThreshold: "0.98",
  maxReserveUseBps: "2500",
  safetyReserveBps: "10000",
  opportunityReserveBps: "0",
  safetyEnabled: true,
  premiumEnabled: true,
  discountEnabled: true
};

export function RulesForm() {
  const { rules, setRules, isPending, error } = useRules();
  const [form, setForm] = useState(defaults);

  useEffect(() => {
    if (!rules) return;
    setForm({
      safetyICR: rules.safetyICR,
      repayBps: rules.repayBps,
      premiumThreshold: rules.premiumThreshold,
      discountThreshold: rules.discountThreshold,
      maxReserveUseBps: rules.maxReserveUseBps,
      safetyReserveBps: rules.safetyReserveBps,
      opportunityReserveBps: rules.opportunityReserveBps,
      safetyEnabled: rules.safetyEnabled,
      premiumEnabled: rules.premiumEnabled,
      discountEnabled: rules.discountEnabled
    });
  }, [rules]);

  const payload = useMemo(() => {
    return {
      safetyICR: parseUnits(form.safetyICR || "0", 18),
      repayBps: BigInt(form.repayBps || "0"),
      premiumThreshold: parseUnits(form.premiumThreshold || "0", 18),
      discountThreshold: parseUnits(form.discountThreshold || "0", 18),
      maxReserveUseBps: BigInt(form.maxReserveUseBps || "0"),
      safetyReserveBps: BigInt(form.safetyReserveBps || "0"),
      opportunityReserveBps: BigInt(form.opportunityReserveBps || "0"),
      safetyEnabled: form.safetyEnabled,
      premiumEnabled: form.premiumEnabled,
      discountEnabled: form.discountEnabled
    };
  }, [form]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Strategy Rules</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Safety ICR (e.g. 1.50)" value={form.safetyICR} onChange={(v) => setForm((f) => ({ ...f, safetyICR: v }))} />
        <Field label="Repay bps (e.g. 1000 = 10%)" value={form.repayBps} onChange={(v) => setForm((f) => ({ ...f, repayBps: v }))} />
        <Field label="Premium trigger (e.g. 1.02)" value={form.premiumThreshold} onChange={(v) => setForm((f) => ({ ...f, premiumThreshold: v }))} />
        <Field label="Discount trigger (e.g. 0.98)" value={form.discountThreshold} onChange={(v) => setForm((f) => ({ ...f, discountThreshold: v }))} />
        <Field label="Max reserve use bps (e.g. 2500 = 25%)" value={form.maxReserveUseBps} onChange={(v) => setForm((f) => ({ ...f, maxReserveUseBps: v }))} />
        <Field label="Safety reserve bps (e.g. 10000 = 100%)" value={form.safetyReserveBps} onChange={(v) => setForm((f) => ({ ...f, safetyReserveBps: v }))} />
        <Field
          label="Opportunity reserve bps (e.g. 0 = 0%)"
          value={form.opportunityReserveBps}
          onChange={(v) => setForm((f) => ({ ...f, opportunityReserveBps: v }))}
        />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Toggle label="Safety repay enabled" checked={form.safetyEnabled} onChange={(v) => setForm((f) => ({ ...f, safetyEnabled: v }))} />
        <Toggle label="Premium enabled" checked={form.premiumEnabled} onChange={(v) => setForm((f) => ({ ...f, premiumEnabled: v }))} />
        <Toggle label="Discount enabled" checked={form.discountEnabled} onChange={(v) => setForm((f) => ({ ...f, discountEnabled: v }))} />
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
