"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trove", label: "Trove" },
  { href: "/rules", label: "Rules" },
  { href: "/sim", label: "Simulation" },
  { href: "/timeline", label: "Timeline" }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        position: "sticky",
        top: 0,
        height: "100dvh",
        padding: 16,
        borderRight: "1px solid var(--border)",
        background: "rgba(0,0,0,0.12)",
        backdropFilter: "blur(10px)",
        zIndex: 10
      }}
    >
      <div style={{ fontWeight: 750, letterSpacing: -0.3, marginBottom: 14 }}>TrovePilot</div>
      <nav style={{ display: "grid", gap: 8 }}>
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: active ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.03)",
                color: "var(--text)"
              }}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12, lineHeight: 1.3 }}>
        Use the sidebar to switch pages.
      </div>
    </aside>
  );
}
