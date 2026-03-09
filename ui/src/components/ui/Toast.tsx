import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Check, X, AlertTriangle, Info, Undo2 } from 'lucide-react';

/* ============================================================================
   Types
   ============================================================================ */

type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'undo';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  /** Toast message */
  message: string;
  /** Visual variant — determines color bar, icon, and behavior */
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Set 0 to persist. Default: 3000 (5000 for undo) */
  duration?: number;
  /** Optional action button (used automatically for 'undo' variant) */
  action?: ToastAction;
  /** Called when toast is dismissed (by timeout, user close, or action) */
  onDismiss?: () => void;
  /** For undo variant: called when countdown expires without undo */
  onExpire?: () => void;
}

interface Toast extends ToastOptions {
  id: string;
  createdAt: number;
  /** Whether the user triggered dismissal (vs auto-expire) */
  dismissed: boolean;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

/* ============================================================================
   Context
   ============================================================================ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

/* ============================================================================
   Variant config
   ============================================================================ */

const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    borderColor: string;
    icon: React.ReactNode;
    defaultDuration: number;
  }
> = {
  success: {
    borderColor: 'var(--success)',
    icon: <Check size={14} strokeWidth={3} />,
    defaultDuration: 3000,
  },
  error: {
    borderColor: 'var(--error)',
    icon: <X size={14} strokeWidth={3} />,
    defaultDuration: 5000,
  },
  warning: {
    borderColor: 'var(--warning)',
    icon: <AlertTriangle size={14} strokeWidth={2.5} />,
    defaultDuration: 4000,
  },
  info: {
    borderColor: 'var(--accent-primary)',
    icon: <Info size={14} strokeWidth={2.5} />,
    defaultDuration: 3000,
  },
  undo: {
    borderColor: 'var(--warning)',
    icon: <Undo2 size={14} strokeWidth={2.5} />,
    defaultDuration: 5000,
  },
};

/* ============================================================================
   Single Toast Component
   ============================================================================ */

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const variant = t.variant ?? 'info';
  const config = VARIANT_CONFIG[variant];
  const duration = t.duration ?? config.defaultDuration;

  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const startRef = useRef(Date.now());
  const rafRef = useRef<number>();

  // Animate the countdown progress bar (undo variant)
  useEffect(() => {
    if (variant !== 'undo' || duration === 0) return;

    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [variant, duration]);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration === 0) return;

    timerRef.current = setTimeout(() => {
      triggerExit(false);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration]);

  const triggerExit = useCallback(
    (wasUserAction: boolean) => {
      if (exiting) return;
      setExiting(true);

      // If undo toast expired without user action, fire onExpire
      if (!wasUserAction && variant === 'undo' && t.onExpire) {
        t.onExpire();
      }

      // Animate out, then remove
      setTimeout(() => onDismiss(t.id), 200);
    },
    [exiting, variant, t, onDismiss]
  );

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    triggerExit(true);
    t.onDismiss?.();
  };

  const handleAction = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    t.action?.onClick();
    triggerExit(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        relative overflow-hidden
        flex items-stretch
        min-w-[280px] max-w-[380px]
        bg-[var(--bg-surface)]
        border-2 border-[var(--border-default)]
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
        transition-all duration-200
        ${exiting ? 'animate-toast-exit' : 'animate-toast-enter'}
      `}
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      {/* Left color bar — severity indicator */}
      <div
        className="w-1 flex-shrink-0"
        style={{ backgroundColor: config.borderColor }}
      />

      {/* Content */}
      <div className="flex-1 flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <span
          className="flex-shrink-0 flex items-center justify-center w-6 h-6"
          style={{ color: config.borderColor }}
        >
          {config.icon}
        </span>

        {/* Message */}
        <p className="flex-1 font-mono text-xs text-[var(--text-secondary)] leading-tight">
          {t.message}
        </p>

        {/* Action button (undo, etc.) */}
        {t.action && (
          <button
            onClick={handleAction}
            className="
              flex-shrink-0
              px-2.5 py-1
              font-mono text-[11px] uppercase tracking-wider font-semibold
              border-2 border-[var(--border-default)]
              bg-[var(--bg-elevated)]
              text-[var(--warning)]
              hover:bg-[var(--warning)] hover:text-black hover:border-[var(--warning)]
              shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
              active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
              active:translate-x-[1px] active:translate-y-[1px]
              transition-all duration-150
            "
          >
            {t.action.label}
          </button>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150"
          aria-label="Dismiss notification"
        >
          <X size={12} />
        </button>
      </div>

      {/* Countdown fuse bar (undo variant only) */}
      {variant === 'undo' && duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--border-default)]">
          <div
            className="h-full transition-none"
            style={{
              width: `${progress}%`,
              backgroundColor: 'var(--warning)',
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Provider + Container
   ============================================================================ */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((options: ToastOptions): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: Toast = {
      ...options,
      id,
      createdAt: Date.now(),
      dismissed: false,
    };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      {/* Toast container — fixed bottom-right stack */}
      <div
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
