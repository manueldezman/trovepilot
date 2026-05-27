"use client";

import Image from "next/image";
import { WalletBar } from "@/components/WalletBar";

export function TopBar({ mobileMenuOpen, onMenuClick }: { mobileMenuOpen: boolean; onMenuClick: () => void }) {
  return (
    <header className="topBar">
      <div className="topBarLeft">
        <button className="iconBtn menuBtn" aria-label="Open menu" onClick={onMenuClick}>
          <MenuIcon />
        </button>
        <div className="mobileBrand" aria-hidden>
          <Image src="/branding/trovepilot-logo.png" alt="TrovePilot" width={120} height={32} style={{ width: "120px", height: "32px", objectFit: "contain" }} />
        </div>
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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
