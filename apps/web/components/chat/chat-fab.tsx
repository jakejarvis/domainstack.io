"use client";

import { IconMessageCircleFilled } from "@tabler/icons-react";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";

import { Button } from "@domainstack/ui/button";
import { Separator } from "@domainstack/ui/separator";
import { Spinner } from "@domainstack/ui/spinner";

const MotionButton = m.create(Button);

export const CHAT_HOTKEY = "Mod+I";

interface ChatFabProps {
  loading?: boolean;
  onClick: () => void;
}

interface ChatFabButtonProps extends Required<ChatFabProps> {
  children: React.ReactNode;
  className: string;
  onHoverEnd?: () => void;
  onHoverStart?: () => void;
  size: "default" | "icon-lg";
}

function ChatFabButton({
  children,
  className,
  loading,
  onClick,
  onHoverEnd,
  onHoverStart,
  size,
}: ChatFabButtonProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <MotionButton
      variant="outline"
      size={size}
      aria-label="Ask AI"
      aria-busy={loading}
      disabled={loading}
      className={className}
      onClick={onClick}
      onHoverEnd={onHoverEnd}
      onHoverStart={onHoverStart}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      whileHover={prefersReducedMotion ? undefined : "hover"}
      transition={{
        duration: 0.25,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </MotionButton>
  );
}

// Static: the gradient itself never changes, so it never needs repainting.
// Rendered oversized and moved with transforms (compositor-only) instead of
// animating the `background` positions directly (paint-only, much costlier).
const MESH_GRADIENT_BACKGROUND = `
  radial-gradient(ellipse at 25% 30%, rgba(56, 189, 248, 0.8) 0%, transparent 50%),
  radial-gradient(ellipse at 75% 65%, rgba(139, 92, 246, 0.7) 0%, transparent 55%),
  radial-gradient(ellipse at 55% 20%, rgba(236, 72, 153, 0.6) 0%, transparent 45%),
  radial-gradient(ellipse at 40% 80%, rgba(34, 197, 94, 0.5) 0%, transparent 50%)
`;

function useMeshGradientMotion(active: boolean) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);
  const scale = useMotionValue(1);

  useAnimationFrame((time) => {
    if (!active) return;

    const t = time / 1000;
    x.set(Math.sin(t * 0.3) * 12 + Math.sin(t * 0.7 + 2) * 6);
    y.set(Math.cos(t * 0.4 + 1) * 12 + Math.cos(t * 0.9 + 3) * 6);
    rotate.set(Math.sin(t * 0.2) * 15);
    scale.set(1 + Math.sin(t * 0.5 + 4) * 0.08);
  });

  return { x, y, rotate, scale };
}

function MobileChatFab({ loading, onClick }: Required<ChatFabProps>) {
  return (
    <ChatFabButton
      loading={loading}
      onClick={onClick}
      size="icon-lg"
      className="group fixed right-6 bottom-6 z-40 overflow-hidden rounded-full shadow-lg backdrop-blur-md transition-none md:hidden"
    >
      <span className="relative z-10 flex items-center justify-center">
        {loading ? (
          <Spinner className="size-4 text-foreground/90" />
        ) : (
          <IconMessageCircleFilled className="size-4 text-foreground/90" aria-hidden="true" />
        )}
      </span>
    </ChatFabButton>
  );
}

function DesktopChatFab({ loading, onClick }: Required<ChatFabProps>) {
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const meshGradient = useMeshGradientMotion(hovered && !prefersReducedMotion);

  return (
    <ChatFabButton
      loading={loading}
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      size="default"
      className="group fixed right-6 bottom-6 z-40 hidden h-8 overflow-hidden px-2.5 shadow-lg backdrop-blur-md transition-none md:flex"
    >
      <m.span
        className="pointer-events-none absolute inset-[-50%] rounded-[inherit]"
        initial={{ opacity: 0 }}
        variants={{ hover: { opacity: 1 } }}
        transition={{ duration: 0.2 }}
        style={{
          background: MESH_GRADIENT_BACKGROUND,
          filter: "blur(4px)",
          x: meshGradient.x,
          y: meshGradient.y,
          rotate: meshGradient.rotate,
          scale: meshGradient.scale,
        }}
      />

      <span className="relative z-10 flex items-center gap-2">
        <span className="text-[13px] leading-none font-semibold tracking-tight">Ask AI</span>
        <Separator
          orientation="vertical"
          className="bg-border/80 group-hover:bg-foreground/40 data-[orientation=vertical]:h-4"
        />
        <kbd className="pointer-events-none font-sans text-xs leading-none font-medium text-foreground/70 select-none">
          {formatForDisplay(CHAT_HOTKEY, { separatorToken: "\u00A0" })}
        </kbd>
      </span>
    </ChatFabButton>
  );
}

export function ChatFab({ loading = false, onClick }: ChatFabProps) {
  // Render both mobile and desktop variants, use CSS to toggle visibility.
  // This avoids a flash of the desktop button while mobile media state hydrates.
  return (
    <>
      <MobileChatFab loading={loading} onClick={onClick} />
      <DesktopChatFab loading={loading} onClick={onClick} />
    </>
  );
}
