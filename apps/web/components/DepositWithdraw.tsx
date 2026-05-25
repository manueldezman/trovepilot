"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useReserveActions } from "@/hooks/useReserveActions";

export function DepositWithdraw() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("0");
  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || "0", 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  const { deposit, withdraw, isPending, error } = useReserveActions();

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "var(--muted)" }}>Reserve actions (MUSD)</div>
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
