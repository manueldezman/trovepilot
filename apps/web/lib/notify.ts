"use client";

import { useSyncExternalStore } from "react";

export type ToastKind = "error" | "success" | "info";

export type ToastItem = {
  id: number;
  title: string;
  message?: string;
  kind: ToastKind;
};

let seq = 1;
let state: ToastItem[] = [];
const emptySnapshot: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function push(item: Omit<ToastItem, "id">) {
  const id = seq++;
  state = [...state, { ...item, id }];
  emit();
  window.setTimeout(() => {
    state = state.filter((toast) => toast.id !== id);
    emit();
  }, 4500);
}

export function notifyError(message: string, title = "Action failed") {
  if (typeof window === "undefined") return;
  push({ title, message, kind: "error" });
}

export function notifySuccess(message: string, title = "Success") {
  if (typeof window === "undefined") return;
  push({ title, message, kind: "success" });
}

export function dismissToast(id: number) {
  state = state.filter((toast) => toast.id !== id);
  emit();
}

export function useToasts() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => emptySnapshot
  );
}
