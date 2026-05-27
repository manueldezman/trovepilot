"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useReserveActions } from "@/hooks/useReserveActions";
import { useVaultState } from "@/hooks/useVaultState";

export function DepositWithdraw() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("0");
  const { data: vault } = useVaultState(address);
  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || "0", 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  const { deposit, withdraw, isPending, error } = useReserveActions();
  const maxWithdrawable = useMemo(() => {
    const musd = (vault as any)?.musdReserveRaw ?? 0n;
    const opp = (vault as any)?.usdcReserveRaw ?? 0n;
    return musd + opp;
  }, [vault]);

  function setMaxWithdraw() {
    if (maxWithdrawable <= 0n) return;
    setAmount(formatUnits(maxWithdrawable, 18));
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "var(--muted)" }}>Reserve actions (MUSD)</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            style={{
              width: 160,
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text)"
            }}
          />
          <button
            type="button"
            onClick={setMaxWithdraw}
            disabled={!address || isPending || maxWithdrawable <= 0n}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              fontSize: 12
            }}
          >
            Max
          </button>
        </div>
      </div>
      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
        Withdrawable: {formatUnits(maxWithdrawable, 18)} MUSD
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button
          disabled={!address || isPending || parsedAmount <= 0n}
          onClick={() => deposit(parsedAmount)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(15,23,42,0.04)",
            color: "var(--text)"
          }}
        >
          Deposit
        </button>
        <button
          disabled={!address || isPending || parsedAmount <= 0n}
          onClick={() => withdraw(parsedAmount)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(15,23,42,0.04)",
            color: "var(--text)"
          }}
        >
          Withdraw
        </button>
      </div>
      {error ? <div style={{ marginTop: 10, color: "#fda4af", fontSize: 12 }}>{error.message}</div> : null}
    </div>
  );
}
