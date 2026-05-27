"use client";

import { dismissToast, useToasts } from "@/lib/notify";

export function ToastViewport() {
  const toasts = useToasts();

  if (!toasts.length) return null;

  return (
    <div className="toastViewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toastItem toast-${toast.kind}`}
          role="status"
        >
          <div style={{ minWidth: 0 }}>
            <div className="toastTitle">{toast.title}</div>
            {toast.message ? <div className="toastMessage">{toast.message}</div> : null}
          </div>
          <button
            className="toastClose"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
