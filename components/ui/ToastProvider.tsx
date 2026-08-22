"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import Toast, { ToastVariant } from "./Toast";

type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; variant: ToastVariant } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback<ShowToast>((message, variant = "success") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    idRef.current += 1;
    setToast({ id: idRef.current, message, variant });
    timeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && <Toast key={toast.id} message={toast.message} variant={toast.variant} />}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
