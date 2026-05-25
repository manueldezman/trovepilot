"use client";

import { OpenTroveForm } from "@/components/OpenTroveForm";

export default function TrovePage() {
  return (
    <main style={{ display: "grid", gap: 14, maxWidth: 980, margin: "0 auto" }}>
      <OpenTroveForm />
    </main>
  );
}
