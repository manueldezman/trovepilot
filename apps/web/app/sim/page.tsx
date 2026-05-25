"use client";

import { SimulationLab } from "@/components/SimulationLab";
import { Timeline } from "@/components/Timeline";

export default function SimulationPage() {
  return (
    <main style={{ display: "grid", gap: 14 }}>
      <SimulationLab />
      <Timeline />
    </main>
  );
}
