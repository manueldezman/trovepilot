"use client";

import { WalletBar } from "@/components/WalletBar";
import { SimulationLab } from "@/components/SimulationLab";
import { Timeline } from "@/components/Timeline";

export default function SimulationPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, display: "grid", gap: 14 }}>
      <WalletBar />
      <SimulationLab />
      <Timeline />
    </main>
  );
}
