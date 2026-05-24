"use client";

import { WalletBar } from "@/components/WalletBar";
import { Timeline } from "@/components/Timeline";

export default function TimelinePage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, display: "grid", gap: 14 }}>
      <WalletBar />
      <Timeline />
    </main>
  );
}
