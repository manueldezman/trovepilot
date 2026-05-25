"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { useRules } from "@/hooks/useRules";

const defaults = {
  targetICR: "1.60",
  bandLowerICR: "1.58",
  bandUpperICR: "1.62",
  premiumThreshold: "1.02",
  discountThreshold: "0.98",
  premiumSellPct: "20",
  discountBuyPct: "20",
  btcDownEnabled: true,
  btcUpEnabled: true,
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
      targetICR: rules.targetICR,
      bandLowerICR: rules.bandLowerICR,
      bandUpperICR: rules.bandUpperICR,
      premiumThreshold: rules.premiumThreshold,
      discountThreshold: rules.discountThreshold,
      premiumSellPct: rules.premiumSellBps,
      discountBuyPct: rules.discountBuyBps,
      btcDownEnabled: rules.btcDownEnabled,
      btcUpEnabled: rules.btcUpEnabled,
      premiumEnabled: rules.premiumEnabled,
      discountEnabled: rules.discountEnabled
    });
  }, [rules]);

  const payload = useMemo(() => {
    setLocalError(null);
    try {
      const premiumSellBps = percentToBps(form.premiumSellPct);
      const discountBuyBps = percentToBps(form.discountBuyPct);

      const targetICR = parseUnits(form.targetICR || "0", 18);
      const bandLowerICR = parseUnits(form.bandLowerICR || "0", 18);
      const bandUpperICR = parseUnits(form.bandUpperICR || "0", 18);

      return {
        targetICR,
        bandLowerICR,
        bandUpperICR,
        premiumThreshold: parseUnits(form.premiumThreshold || "0", 18),
        discountThreshold: parseUnits(form.discountThreshold || "0", 18),
        premiumSellBps,
        discountBuyBps,
        btcDownEnabled: form.btcDownEnabled,
        btcUpEnabled: form.btcUpEnabled,
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
        <Field label="Target ICR (default 1.60)" value={form.targetICR} onChange={(v) => setForm((f) => ({ ...f, targetICR: v }))} />
        <Field label="Band lower (default 1.58)" value={form.bandLowerICR} onChange={(v) => setForm((f) => ({ ...f, bandLowerICR: v }))} />
        <Field label="Band upper (default 1.62)" value={form.bandUpperICR} onChange={(v) => setForm((f) => ({ ...f, bandUpperICR: v }))} />
        <Field label="Premium threshold (e.g. 1.02)" value={form.premiumThreshold} onChange={(v) => setForm((f) => ({ ...f, premiumThreshold: v }))} />
        <Field label="Discount threshold (e.g. 0.98)" value={form.discountThreshold} onChange={(v) => setForm((f) => ({ ...f, discountThreshold: v }))} />
        <Field label="Premium sell % (default 20)" value={form.premiumSellPct} numeric onChange={(v) => setForm((f) => ({ ...f, premiumSellPct: v }))} />
        <Field label="Discount buy % (default 20)" value={form.discountBuyPct} numeric onChange={(v) => setForm((f) => ({ ...f, discountBuyPct: v }))} />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Toggle label="BTC down stabilization" checked={form.btcDownEnabled} onChange={(v) => setForm((f) => ({ ...f, btcDownEnabled: v }))} />
        <Toggle label="BTC up refill" checked={form.btcUpEnabled} onChange={(v) => setForm((f) => ({ ...f, btcUpEnabled: v }))} />
        <Toggle label="Premium rotation" checked={form.premiumEnabled} onChange={(v) => setForm((f) => ({ ...f, premiumEnabled: v }))} />
        <Toggle label="Discount rotation" checked={form.discountEnabled} onChange={(v) => setForm((f) => ({ ...f, discountEnabled: v }))} />
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

