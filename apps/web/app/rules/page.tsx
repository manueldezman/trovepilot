"use client";

import { WalletBar } from "@/components/WalletBar";
import { RulesForm } from "@/components/RulesForm";

export default function RulesPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, display: "grid", gap: 14 }}>
      <WalletBar />
      <RulesForm />
    </main>
  );
}
