"use client";

import { WalletBar } from "@/components/WalletBar";

export function TopBar() {
  return (
    <header className="topBar">
      <div className="topBarLeft">
        <button className="iconBtn" aria-label="Menu">
          ≡
        </button>
        <div className="searchWrap">
          <input className="searchInput" placeholder="Search" />
        </div>
      </div>
      <div className="topBarRight">
        <WalletBar variant="compact" />
      </div>
    </header>
  );
}

