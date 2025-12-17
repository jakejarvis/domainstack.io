"use client";

import { Toast } from "@base-ui/react/toast";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type ToastType = "default" | "success" | "info" | "warning" | "error";

export type ToastOptions = {
  /** Stable ID for de-duping and manual dismissal (Sonner-compatible). */
  id?: string;
  /** Secondary text below the title. */
  description?: React.ReactNode;
  /** Optional icon displayed on the left. */
  icon?: React.ReactNode;
  /** Where to render the toast viewport (Sonner-compatible). */
  position?: ToastPosition;
  /** Auto-dismiss timeout in ms (Sonner-compatible). */
  duration?: number;
};

type InternalToastData = {
  type?: ToastType;
  icon?: React.ReactNode;
  /** User-provided stable id (Sonner-style). */
  stableId?: string;
};

const DEFAULT_POSITION: ToastPosition = "bottom-right";
const DEFAULT_TIMEOUT_MS = 4000;

const POSITIONS: ToastPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const toastManagers = Object.fromEntries(
  POSITIONS.map((pos) => [pos, Toast.createToastManager()]),
) as Record<ToastPosition, ReturnType<typeof Toast.createToastManager>>;

const activeToastIds = Object.fromEntries(
  POSITIONS.map((pos) => [pos, new Set<string>()]),
) as Record<ToastPosition, Set<string>>;

// Map Sonner-style stable IDs → Base UI toast IDs (scoped by position)
const stableIdMap = new Map<
  string,
  { toastId: string; position: ToastPosition }
>();

function normalizeTimeout(duration?: number): number | undefined {
  if (duration === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(duration)) return DEFAULT_TIMEOUT_MS;
  if (duration <= 0) return undefined; // Sonner: 0 disables auto-dismiss
  return duration;
}

function withStableIdCleanup(
  stableId: string | undefined,
  position: ToastPosition,
  existingOnRemove?: () => void,
) {
  if (!stableId) return existingOnRemove;

  return () => {
    const current = stableIdMap.get(stableId);
    if (current?.position === position) {
      stableIdMap.delete(stableId);
    }
    existingOnRemove?.();
  };
}

function addOrUpdateToast(
  type: ToastType,
  title: React.ReactNode,
  options?: ToastOptions,
) {
  const position = options?.position ?? DEFAULT_POSITION;
  const toastManager = toastManagers[position];
  const stableId = options?.id;

  const baseOptions = {
    title,
    description: options?.description,
    type,
    timeout: normalizeTimeout(options?.duration),
    data: {
      type,
      icon: options?.icon,
      stableId,
    } satisfies InternalToastData,
  };

  if (stableId) {
    const existing = stableIdMap.get(stableId);
    if (existing && existing.position === position) {
      toastManager.update(existing.toastId, baseOptions);
      return existing.toastId;
    }
  }

  const toastId = toastManager.add({
    ...baseOptions,
    onRemove: () => {
      activeToastIds[position].delete(toastId);
      withStableIdCleanup(stableId, position)?.();
    },
  });

  activeToastIds[position].add(toastId);
  if (stableId) {
    stableIdMap.set(stableId, { toastId, position });
  }

  return toastId;
}

export const toast = {
  success: (title: React.ReactNode, options?: ToastOptions) =>
    addOrUpdateToast("success", title, options),
  info: (title: React.ReactNode, options?: ToastOptions) =>
    addOrUpdateToast("info", title, options),
  warning: (title: React.ReactNode, options?: ToastOptions) =>
    addOrUpdateToast("warning", title, options),
  error: (title: React.ReactNode, options?: ToastOptions) =>
    addOrUpdateToast("error", title, options),
  message: (title: React.ReactNode, options?: ToastOptions) =>
    addOrUpdateToast("default", title, options),
  dismiss: (id?: string) => {
    // Dismiss a stable Sonner-style ID if we have one
    if (id) {
      const stable = stableIdMap.get(id);
      if (stable) {
        toastManagers[stable.position].close(stable.toastId);
        activeToastIds[stable.position].delete(stable.toastId);
        return;
      }

      // Otherwise, treat it as a Base UI toastId and attempt to close across all positions.
      for (const pos of POSITIONS) {
        toastManagers[pos].close(id);
        activeToastIds[pos].delete(id);
      }
      return;
    }

    // Dismiss all toasts across all positions.
    for (const pos of POSITIONS) {
      const manager = toastManagers[pos];
      const ids = Array.from(activeToastIds[pos]);
      for (const toastId of ids) {
        manager.close(toastId);
      }
      activeToastIds[pos].clear();
    }
    stableIdMap.clear();
  },
};

const toastViewportVariants = cva(
  "pointer-events-none fixed z-[1000] w-full max-w-[420px] px-4 select-none outline-none [@media(min-width:640px)]:px-0",
  {
    variants: {
      position: {
        "top-left": "top-4 left-4 items-start",
        "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
        "top-right": "top-4 right-4 items-end",
        "bottom-left": "bottom-4 left-4 items-start",
        "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
        "bottom-right": "bottom-4 right-4 items-end",
      } satisfies Record<ToastPosition, string>,
    },
  },
);

const toastAccentVariants = cva("border-l-4", {
  variants: {
    type: {
      default: "border-l-border",
      success: "border-l-accent-green",
      info: "border-l-primary",
      warning: "border-l-amber-500",
      error: "border-l-destructive",
    } satisfies Record<ToastType, string>,
  },
  defaultVariants: {
    type: "default",
  },
});

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((t) => {
    const data = (t.data ?? {}) as Partial<InternalToastData>;
    const type = data.type;
    const icon = data.icon;

    return (
      <Toast.Root
        key={t.id}
        toast={t}
        className={cn(
          // Base layout
          "pointer-events-auto absolute inset-x-0 w-full",
          "rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-lg",
          // Sonner-ish: subtle left accent per type
          toastAccentVariants({ type: type ?? "default" }),
          // Motion
          "will-change-transform",
          "transition-[opacity,transform,filter] duration-200 ease-out",
          // When swiping/dismissing
          "data-[ending-style]:opacity-0 data-[ending-style]:blur-[1px]",
          "data-[limited]:opacity-0",
        )}
        style={
          {
            zIndex: "calc(1000 - var(--toast-index))",
            transform:
              "scale(calc(1 - (0.08 * var(--toast-index)))) translateX(var(--toast-swipe-movement-x)) translateY(calc(var(--toast-swipe-movement-y) + (var(--toast-index) * -18%)))",
          } as React.CSSProperties
        }
      >
        <Toast.Content
          className={cn(
            "flex w-full items-start gap-3 overflow-hidden px-3 py-2.5",
            // Collapsed stack: hide content behind the front toast, restore on hover/focus
            "transition-opacity duration-200",
            "data-[behind]:opacity-0 data-[expanded]:opacity-100",
          )}
        >
          {icon ? (
            <div className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4">
              {icon}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <Toast.Title className="line-clamp-2 font-medium text-sm" />
            <Toast.Description className="mt-0.5 line-clamp-3 text-muted-foreground text-xs" />
          </div>

          <Toast.Close
            aria-label="Close"
            className={cn(
              "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            )}
          >
            <X className="size-4" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}

export type ToasterProps = {
  /** Override default viewport width. */
  className?: string;
};

/**
 * Base UI toast renderer (replacement for Sonner's <Toaster />).
 *
 * Wraps multiple Base UI providers so per-toast `position` behaves like Sonner.
 */
export function Toaster({ className }: ToasterProps) {
  return (
    <>
      {POSITIONS.map((position) => (
        <Toast.Provider key={position} toastManager={toastManagers[position]}>
          <Toast.Portal>
            <Toast.Viewport
              className={cn(toastViewportVariants({ position }), className)}
            >
              <ToastList />
            </Toast.Viewport>
          </Toast.Portal>
        </Toast.Provider>
      ))}
    </>
  );
}
