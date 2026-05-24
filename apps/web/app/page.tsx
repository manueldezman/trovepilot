import Link from "next/link";
import { WalletBar } from "@/components/WalletBar";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rules", label: "Strategy Rules" },
  { href: "/sim", label: "Simulation Lab" },
  { href: "/timeline", label: "Execution Timeline" }
];

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <WalletBar />
      <div style={{ marginTop: 18, padding: 18, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.6 }}>TrovePilot</h1>
        <p style={{ marginTop: 10, marginBottom: 0, color: "var(--muted)" }}>
          Autopilot for Bitcoin-backed borrowing on Mezo — real trove reads + real collateral-defense repayment, with simulated peg conditions.
        </p>
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.03)"
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
