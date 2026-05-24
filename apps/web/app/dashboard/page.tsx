"use client";

import { WalletBar } from "@/components/WalletBar";
import { TroveOverview } from "@/components/TroveOverview";
import { VaultOverview } from "@/components/VaultOverview";

export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, display: "grid", gap: 14 }}>
      <WalletBar />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <TroveOverview />
        <VaultOverview />
      </div>
    </main>
  );
}
