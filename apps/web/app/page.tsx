import { IcrHealthCard } from "@/components/IcrHealthCard";
import { TroveOverview } from "@/components/TroveOverview";
import { VaultOverview } from "@/components/VaultOverview";
import { HeroHeader } from "@/components/HeroHeader";
import { LiquidCoverageCard } from "@/components/LiquidCoverageCard";
import { ReserveCompositionCard } from "@/components/ReserveCompositionCard";

export default function HomePage() {
  return (
    <main style={{ display: "grid", gap: 14 }}>
      <HeroHeader />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 14,
          alignItems: "start"
        }}
      >
        <IcrHealthCard />
        <div style={{ display: "grid", gap: 14 }}>
          <VaultOverview />
          <LiquidCoverageCard />
          <ReserveCompositionCard />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 14,
          alignItems: "start"
        }}
      >
        <TroveOverview />
      </div>
    </main>
  );
}
