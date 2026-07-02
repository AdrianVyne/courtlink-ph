"use client";

import { X } from "lucide-react";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Tone = "success" | "danger";

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  push: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

const DISMISS_MS = 5000;

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only pauses the auto-dismiss timer; the element is not interactive.
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-(--radius-control) border px-4 py-3 text-sm font-medium shadow-(--shadow-float) ${
        toast.tone === "danger"
          ? "border-danger-fg/30 bg-danger-bg text-danger-fg"
          : "border-court-200 bg-white text-ink-900"
      }`}
      data-tone={toast.tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span>{toast.message}</span>
      <button
        className="ml-auto inline-flex size-6 items-center justify-center rounded-full text-current hover:bg-black/5"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <X aria-hidden="true" size={14} />
        <span className="sr-only">Dismiss notification</span>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6"
        role="status"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} onDismiss={dismiss} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
