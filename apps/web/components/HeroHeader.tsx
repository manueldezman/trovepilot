"use client";

export function HeroHeader({
  title = "TrovePilot",
  subtitle = "Track reserve health, rebalance liquidity, and stabilize your borrowing position through BTC volatility and MUSD peg shifts."
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section
      style={{
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "var(--panel)",
        boxShadow: "var(--shadow)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.2 }}>Adaptive Reserve Coordination for Mezo</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{title}</h1>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 820, letterSpacing: -0.3, maxWidth: 920 }}>
            Adaptive reserve coordination for leveraged Bitcoin borrowing.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge label="Stability Liquidity" />
          <Badge label="Reserve Rebalancing" />
          <Badge label="Reserve Activity" />
        </div>
      </div>
      <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, maxWidth: 860 }}>{subtitle}</p>
    </section>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: "rgba(15,23,42,0.03)",
        fontSize: 12,
        fontWeight: 650,
        color: "rgba(15,23,42,0.72)"
      }}
    >
      {label}
    </span>
  );
}
