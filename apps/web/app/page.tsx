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
      <div className="dashboardGrid">
        <IcrHealthCard />
        <VaultOverview />
        <LiquidCoverageCard />
        <ReserveCompositionCard />
        <div className="span2">
          <TroveOverview />
        </div>
      </div>
    </main>
  );
}
