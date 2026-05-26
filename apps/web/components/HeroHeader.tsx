"use client";

export function HeroHeader({
  subtitle = "Track reserve health, rebalance liquidity, and stabilize your borrowing position through BTC volatility and MUSD peg shifts."
}: {
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 820, letterSpacing: -0.4, maxWidth: 920, lineHeight: 1.2 }}>
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
        background: "var(--surface-2)",
        fontSize: 12,
        fontWeight: 650,
        color: "var(--text)"
      }}
    >
      {label}
    </span>
  );
}
