"use client";

import type { ReactNode } from "react";

export function PreviewModal({
  open,
  title,
  subtitle,
  loading,
  warning,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  loading?: boolean;
  warning?: string | null;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.28)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 50
      }}
    >
      <div
        style={{
          width: "min(720px, 96vw)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          background: "var(--panel2)",
          boxShadow: "var(--shadow2)",
          overflow: "hidden"
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.2 }}>Preview</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>{title}</div>
          {subtitle ? <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>{subtitle}</div> : null}
        </div>

        <div style={{ padding: 16 }}>
          {loading ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading preview…</div> : children}
          {warning ? (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(245,158,11,0.14)", color: "#8a4b00", fontSize: 12 }}>
              {warning}
            </div>
          ) : null}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="ghostBtn" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className="primaryBtn" onClick={onConfirm} disabled={confirmDisabled || loading}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

