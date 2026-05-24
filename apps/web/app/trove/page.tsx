"use client";

import { WalletBar } from "@/components/WalletBar";
import { OpenTroveForm } from "@/components/OpenTroveForm";

export default function TrovePage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, display: "grid", gap: 14 }}>
      <WalletBar />
      <OpenTroveForm />
    </main>
  );
}

