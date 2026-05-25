import { VaultOverview } from "@/components/VaultOverview";

export default function VaultPage() {
  return (
    <main style={{ display: "grid", gap: 14 }}>
      <VaultOverview showActions />
    </main>
  );
}

