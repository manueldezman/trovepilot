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
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, alignItems: "stretch" }}>
        <IcrHealthCard />
        <div style={{ display: "grid", gap: 14 }}>
          <VaultOverview />
          <LiquidCoverageCard />
          <ReserveCompositionCard />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <TroveOverview />
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)", height: "100%" }}>
            <div style={{ fontWeight: 750, letterSpacing: -0.2 }}>System</div>
            <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
              TrovePilot monitors simulated market state and runs automation. Use <span style={{ fontFamily: "var(--mono)" }}>/sim</span> to trigger scenarios.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
