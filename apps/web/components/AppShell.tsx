"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { SidebarNav } from "@/components/SidebarNav";
import { TopBar } from "@/components/TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? null;
    touchCurrentXRef.current = touchStartXRef.current;
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    touchCurrentXRef.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd() {
    if (touchStartXRef.current == null || touchCurrentXRef.current == null) return;
    const delta = touchCurrentXRef.current - touchStartXRef.current;
    if (delta < -50) setMobileOpen(false);
    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
  }

  return (
    <div className="appFrame">
      <aside className="sidebarDesktop">
        <SidebarNav />
      </aside>

      <div className={`drawerBackdrop ${mobileOpen ? "open" : ""}`} onClick={() => setMobileOpen(false)} aria-hidden={!mobileOpen} />
      <aside
        className={`drawerPanel ${mobileOpen ? "open" : ""}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <SidebarNav mobile onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
      </aside>

      <div className="appMain">
        <TopBar mobileMenuOpen={mobileOpen} onMenuClick={() => setMobileOpen((v) => !v)} />
        <div className="appContent">{children}</div>
      </div>
    </div>
  );
}
