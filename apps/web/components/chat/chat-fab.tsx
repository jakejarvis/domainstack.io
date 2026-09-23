"use client";

import { IconMessageCircleFilled } from "@tabler/icons-react";
import { formatForDisplay } from "@tanstack/react-hotkeys";

import { Button } from "@domainstack/ui/button";
import { Separator } from "@domainstack/ui/separator";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

export const CHAT_HOTKEY = "Mod+I";

interface ChatFabProps {
  loading?: boolean;
  onClick: () => void;
  /** Hover/focus intent, so the chat bundle can start loading before the click. */
  onPrefetch?: () => void;
}

interface ChatFabButtonProps extends Required<Omit<ChatFabProps, "onPrefetch">> {
  onPrefetch?: () => void;
  children: React.ReactNode;
  className: string;
  size: "default" | "icon-lg";
}

function ChatFabButton({
  children,
  className,
  loading,
  onClick,
  onPrefetch,
  size,
}: ChatFabButtonProps) {
  return (
    <Button
      variant="outline"
      size={size}
      aria-label="Ask AI"
      aria-busy={loading}
      disabled={loading}
      className={cn(
        "animate-in duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none",
        className,
      )}
      onClick={onClick}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      {children}
    </Button>
  );
}

// Static: the gradient itself never changes, so it never needs repainting.
// Rendered oversized and drifted with a CSS animation on transforms (compositor-only) that only
// plays while hovered, instead of animating the `background` positions directly.
const MESH_GRADIENT_BACKGROUND = `
  radial-gradient(ellipse at 25% 30%, rgba(56, 189, 248, 0.8) 0%, transparent 50%),
  radial-gradient(ellipse at 75% 65%, rgba(139, 92, 246, 0.7) 0%, transparent 55%),
  radial-gradient(ellipse at 55% 20%, rgba(236, 72, 153, 0.6) 0%, transparent 45%),
  radial-gradient(ellipse at 40% 80%, rgba(34, 197, 94, 0.5) 0%, transparent 50%)
`;

function MobileChatFab({ loading, onClick, onPrefetch }: ChatFabProps & { loading: boolean }) {
  return (
    <ChatFabButton
      loading={loading}
      onClick={onClick}
      onPrefetch={onPrefetch}
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

function DesktopChatFab({ loading, onClick, onPrefetch }: ChatFabProps & { loading: boolean }) {
  return (
    <ChatFabButton
      loading={loading}
      onClick={onClick}
      onPrefetch={onPrefetch}
      size="default"
      className="group fixed right-6 bottom-6 z-40 hidden h-8 overflow-hidden px-2.5 shadow-lg backdrop-blur-md transition-none md:flex"
    >
      <span
        data-slot="mesh-gradient"
        className="pointer-events-none absolute inset-[-50%] animate-mesh-drift rounded-[inherit] opacity-0 blur-[4px] transition-opacity duration-200 group-hover:opacity-100 group-hover:[animation-play-state:running] motion-reduce:hidden"
        style={{ background: MESH_GRADIENT_BACKGROUND }}
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

export function ChatFab({ loading = false, onClick, onPrefetch }: ChatFabProps) {
  // Render both mobile and desktop variants, use CSS to toggle visibility.
  // This avoids a flash of the desktop button while mobile media state hydrates.
  return (
    <>
      <MobileChatFab loading={loading} onClick={onClick} onPrefetch={onPrefetch} />
      <DesktopChatFab loading={loading} onClick={onClick} onPrefetch={onPrefetch} />
    </>
  );
}
