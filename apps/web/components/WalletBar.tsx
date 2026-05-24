"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { mezoChainId, mezoExplorerUrl } from "@/lib/mezo";

export function WalletBar() {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== mezoChainId;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: 14,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--panel)"
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 650 }}>Wallet</div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          {isConnected ? (
            <>
              {address}{" "}
              {mezoExplorerUrl ? (
                <a href={`${mezoExplorerUrl}/address/${address}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                  explorer
                </a>
              ) : null}
            </>
          ) : (
            "Not connected"
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {wrongNetwork ? (
          <button
            onClick={() => switchChain({ chainId: mezoChainId })}
            disabled={isSwitching}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(124,58,237,0.25)",
              color: "var(--text)"
            }}
          >
            {isSwitching ? "Switching…" : "Switch to Mezo"}
          </button>
        ) : null}

        {isConnected ? (
          <button
            onClick={() => disconnect()}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text)"
            }}
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: injected() })}
            disabled={isConnecting}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(124,58,237,0.25)",
              color: "var(--text)"
            }}
          >
            {isConnecting ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>

      {(connectError || switchError) && (
        <div style={{ color: "#fda4af", fontSize: 12 }}>
          {(connectError ?? switchError)?.message}
        </div>
      )}
    </div>
  );
}
