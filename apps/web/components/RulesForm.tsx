"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { useRules } from "@/hooks/useRules";

const defaults = {
  safetyICR: "1.50",
  premiumThreshold: "1.02",
  discountThreshold: "0.98",
  maxReserveUseBps: "25",
  safetyReservePct: 100,
  safetyEnabled: true,
  premiumEnabled: true,
  discountEnabled: true
};

export function RulesForm() {
  const { rules, setRules, isPending, error } = useRules();
  const [form, setForm] = useState(defaults);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!rules) return;
    setForm({
      safetyICR: rules.safetyICR,
      premiumThreshold: rules.premiumThreshold,
      discountThreshold: rules.discountThreshold,
      maxReserveUseBps: rules.maxReserveUseBps,
      safetyReservePct: clampPct(Number(rules.safetyReserveBps ?? "100")),
      safetyEnabled: rules.safetyEnabled,
      premiumEnabled: rules.premiumEnabled,
      discountEnabled: rules.discountEnabled
    });
  }, [rules]);

  const opportunityPct = useMemo(() => 100 - clampPct(form.safetyReservePct), [form.safetyReservePct]);

  const payload = useMemo(() => {
    setLocalError(null);
    try {
      const maxReserveUseBps = percentToBps(form.maxReserveUseBps);
      const safetyReserveBps = BigInt(clampPct(form.safetyReservePct)) * 100n;
      const opportunityReserveBps = BigInt(100 - clampPct(form.safetyReservePct)) * 100n;

      return {
        safetyICR: parseUnits(form.safetyICR || "0", 18),
        premiumThreshold: parseUnits(form.premiumThreshold || "0", 18),
        discountThreshold: parseUnits(form.discountThreshold || "0", 18),
        maxReserveUseBps,
        safetyReserveBps,
        opportunityReserveBps,
        safetyEnabled: form.safetyEnabled,
        premiumEnabled: form.premiumEnabled,
        discountEnabled: form.discountEnabled
      };
    } catch (e) {
      setLocalError((e as Error).message);
      return null;
    }
  }, [form]);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Strategy Rules</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Safety ICR (e.g. 1.50)" value={form.safetyICR} onChange={(v) => setForm((f) => ({ ...f, safetyICR: v }))} />
        <Field label="Premium trigger (e.g. 1.02)" value={form.premiumThreshold} onChange={(v) => setForm((f) => ({ ...f, premiumThreshold: v }))} />
        <Field label="Discount trigger (e.g. 0.98)" value={form.discountThreshold} onChange={(v) => setForm((f) => ({ ...f, discountThreshold: v }))} />
        <Field
          label="Max safety reserve use % (e.g. 25)"
          value={form.maxReserveUseBps}
          numeric
          onChange={(v) => setForm((f) => ({ ...f, maxReserveUseBps: v }))}
        />
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div style={{ fontWeight: 700 }}>Reserve split</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            Safety <span style={{ fontFamily: "var(--mono)" }}>{clampPct(form.safetyReservePct)}%</span> · Opportunity{" "}
            <span style={{ fontFamily: "var(--mono)" }}>{opportunityPct}%</span>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={clampPct(form.safetyReservePct)}
            onChange={(e) => setForm((f) => ({ ...f, safetyReservePct: clampPct(Number(e.target.value)) }))}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Toggle label="Safety repay enabled" checked={form.safetyEnabled} onChange={(v) => setForm((f) => ({ ...f, safetyEnabled: v }))} />
        <Toggle label="Premium enabled" checked={form.premiumEnabled} onChange={(v) => setForm((f) => ({ ...f, premiumEnabled: v }))} />
        <Toggle label="Discount enabled" checked={form.discountEnabled} onChange={(v) => setForm((f) => ({ ...f, discountEnabled: v }))} />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button
          disabled={isPending || !payload}
          onClick={() => payload && setRules(payload)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--accentFill)",
            color: "var(--text)"
          }}
        >
          {isPending ? "Saving…" : "Save rules onchain"}
        </button>
      </div>

      {localError ? <div style={{ marginTop: 10, color: "var(--critical)", fontSize: 12 }}>{localError}</div> : null}
      {error ? <div style={{ marginTop: 10, color: "var(--critical)", fontSize: 12 }}>{error.message}</div> : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  numeric
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "var(--muted)", fontSize: 13 }}>{label}</span>
      <input
        value={value}
        inputMode={numeric ? "decimal" : undefined}
        pattern={numeric ? "[0-9]*[.]?[0-9]*" : undefined}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "rgba(15,23,42,0.03)",
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

function percentToBps(v: string): bigint {
  const cleaned = (v ?? "").trim().replace(/[^\d.]/g, "");
  if (!cleaned) return 0n;
  const [wholeRaw, fracRaw = ""] = cleaned.split(".");
  const whole = wholeRaw ? BigInt(wholeRaw) : 0n;
  const frac2 = (fracRaw + "00").slice(0, 2);
  const frac = frac2 ? BigInt(frac2) : 0n;
  const bps = whole * 100n + frac;
  if (bps > 10_000n) throw new Error("Percent must be <= 100");
  return bps;
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Math.round(v);
}
