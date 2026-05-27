"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/trove", label: "Trove", icon: TroveIcon },
  { href: "/rules", label: "Rules", icon: RulesIcon },
  { href: "/vault", label: "Vault", icon: VaultIcon },
  { href: "/sim", label: "Simulation", icon: SimIcon },
  { href: "/timeline", label: "Timeline", icon: TimelineIcon }
];

export function SidebarNav({ mobile = false, onNavigate, onClose }: { mobile?: boolean; onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={`sidebarBase ${mobile ? "sidebarMobile" : ""}`}
      style={{
        position: "sticky",
        top: 0,
        height: "100dvh",
        padding: 16,
        borderRight: "1px solid var(--border)",
        background: "var(--panel2)",
        zIndex: 10
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <Image
          src="/branding/trovepilot-logo.png"
          alt="TrovePilot"
          width={240}
          height={64}
          style={{ width: "100%", maxWidth: 220, height: "auto", objectFit: "contain" }}
          priority
        />
        {mobile ? (
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      <nav style={{ display: "grid", gap: 8 }}>
        {items.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onNavigate}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: active ? "var(--accentFill)" : "rgba(15,23,42,0.03)",
                color: "var(--text)"
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    color: active ? "var(--accent)" : "var(--text)"
                  }}
                >
                  <Icon />
                </span>
                <span style={{ fontWeight: 650 }}>{it.label}</span>
              </span>
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

function svgBase() {
  return { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
}

function DashboardIcon() {
  return (
    <svg {...svgBase()}>
      <path d="M4 13h7V4H4v9z" />
      <path d="M13 20h7V11h-7v9z" />
      <path d="M13 4h7v5h-7V4z" />
      <path d="M4 20h7v-5H4v5z" />
    </svg>
  );
}

function TroveIcon() {
  return (
    <svg {...svgBase()}>
      <path d="M12 3v18" />
      <path d="M7 7h10" />
      <path d="M7 17h10" />
      <path d="M8 12h8" />
    </svg>
  );
}

function RulesIcon() {
  return (
    <svg {...svgBase()}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function SimIcon() {
  return (
    <svg {...svgBase()}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg {...svgBase()}>
      <path d="M3 7h18" />
      <path d="M5 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
      <path d="M6 7v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M9 12h6" />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg {...svgBase()}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 8h18" />
      <path d="M5 6h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}
