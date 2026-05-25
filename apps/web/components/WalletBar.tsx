"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { mezoChainId, mezoExplorerUrl } from "@/lib/mezo";

export function WalletBar({ variant = "panel" }: { variant?: "panel" | "compact" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  const showConnected = mounted && isConnected;
  const wrongNetwork = showConnected && chainId !== mezoChainId;
  const short = showConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  if (variant === "compact") {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div
          title={showConnected ? address : undefined}
          style={{
            color: "var(--muted)",
            fontSize: 12,
            fontFamily: "var(--mono)",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {showConnected ? short : "Not connected"}
        </div>

        {wrongNetwork ? (
          <button className="primaryBtn" onClick={() => switchChain({ chainId: mezoChainId })} disabled={isSwitching}>
            {isSwitching ? "Switching…" : "Switch"}
          </button>
        ) : showConnected ? (
          <button className="ghostBtn" onClick={() => disconnect()}>
            Disconnect
          </button>
        ) : (
          <button className="primaryBtn" onClick={() => connect({ connector: injected() })} disabled={isConnecting}>
            {mounted ? (isConnecting ? "Connecting…" : "Connect") : "Connect"}
          </button>
        )}

        {(connectError || switchError) ? (
          <div style={{ color: "var(--critical)", fontSize: 12, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(connectError ?? switchError)?.message}
          </div>
        ) : null}
      </div>
    );
  }

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
          {showConnected ? (
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
            className="primaryBtn"
          >
            {isSwitching ? "Switching…" : "Switch to Mezo"}
          </button>
        ) : null}

        {showConnected ? (
          <button onClick={() => disconnect()} className="ghostBtn">
            Disconnect
          </button>
        ) : (
          <button onClick={() => connect({ connector: injected() })} disabled={isConnecting} className="primaryBtn">
            {mounted ? (isConnecting ? "Connecting…" : "Connect") : "Connect"}
          </button>
        )}
      </div>

      {(connectError || switchError) && <div style={{ color: "var(--critical)", fontSize: 12 }}>{(connectError ?? switchError)?.message}</div>}
    </div>
  );
}
