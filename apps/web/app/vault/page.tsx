 "use client";

import { useEffect, useMemo, useState } from "react";
import { VaultOverview } from "@/components/VaultOverview";
import { addresses } from "@/lib/addresses";
import { mezoExplorerUrl } from "@/lib/mezo";

export default function VaultPage() {
  const oldVault = addresses.oldVault;
  const newVault = addresses.vault;
  const dismissKey = useMemo(() => (oldVault ? `tp_old_vault_notice:${oldVault.toLowerCase()}` : null), [oldVault]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissKey) return;
    try {
      setDismissed(localStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  return (
    <main style={{ display: "grid", gap: 14 }}>
      {oldVault && oldVault !== newVault && !dismissed ? (
        <section
          style={{
            padding: 14,
            border: "1px solid var(--border)",
            borderRadius: 14,
            background: "var(--panel)",
            boxShadow: "var(--shadow1)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 760, letterSpacing: -0.2 }}>Vault upgraded</div>
            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.35 }}>
              Funds you deposited before the upgrade remain in the old vault. Withdraw from the old vault and deposit into the new vault to continue using automation.
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>old vault: {oldVault}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {mezoExplorerUrl ? (
              <a
                href={`${mezoExplorerUrl}/address/${oldVault}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(15,23,42,0.04)",
                  color: "var(--text)",
                  textDecoration: "none",
                  fontWeight: 650
                }}
              >
                Go to old vault
              </a>
            ) : null}
            <button
              onClick={() => {
                if (!dismissKey) return setDismissed(true);
                try {
                  localStorage.setItem(dismissKey, "1");
                } catch {}
                setDismissed(true);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(15,23,42,0.02)",
                color: "var(--muted)"
              }}
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}
      <VaultOverview showActions />
    </main>
  );
}
