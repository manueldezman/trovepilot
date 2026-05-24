"use client";

import { useAccount } from "wagmi";
import { useTimeline } from "@/hooks/useTimeline";

export function Timeline() {
  const { address } = useAccount();
  const { data: events = [], isLoading, error } = useTimeline(address);

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Execution Timeline</h2>

      {!address ? <p style={{ color: "var(--muted)" }}>Connect a wallet to view events.</p> : null}
      {isLoading ? <p style={{ color: "var(--muted)" }}>Loading…</p> : null}
      {error ? <p style={{ color: "#fda4af" }}>{error.message}</p> : null}

      <div style={{ display: "grid", gap: 10 }}>
        {events.map((e) => (
          <div key={e.id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 650 }}>{e.title}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{e.when}</div>
            </div>
            <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>{e.detail}</div>
            {e.txUrl ? (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                <a href={e.txUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                  View transaction
                </a>
              </div>
            ) : null}
          </div>
        ))}
        {events.length === 0 && address ? <p style={{ color: "var(--muted)" }}>No events yet. Try running an action in Simulation Lab.</p> : null}
      </div>
    </section>
  );
}
