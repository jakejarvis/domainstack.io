"use client";

import { Button } from "@domainstack/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { cn } from "@domainstack/ui/utils";
import {
  IconArrowFork,
  IconBrandChrome,
  IconChevronDown,
  IconCloud,
  IconDownload,
} from "@tabler/icons-react";
import { type BrowserAIStatus, useBrowserAI } from "@/hooks/use-browser-ai";
import {
  type AiModePreference,
  usePreferencesStore,
} from "@/lib/stores/preferences-store";

interface ChatModeSelectorProps {
  className?: string;
  /** Disable the selector (e.g., while chat is active) */
  disabled?: boolean;
}

function getStatusLabel(
  status: BrowserAIStatus,
  downloadProgress?: number,
): string {
  switch (status) {
    case "unavailable":
      return "Not supported";
    case "checking":
      return "Checking…";
    case "downloadable":
      return "Download required";
    case "downloading":
      return `Downloading… ${Math.round((downloadProgress ?? 0) * 100)}%`;
    case "ready":
      return "Ready";
    case "error":
      return "Error";
    default:
      return "";
  }
}

export function ChatModeSelector({
  className,
  disabled,
}: ChatModeSelectorProps) {
  const aiMode = usePreferencesStore((s) => s.aiMode);
  const setAiMode = usePreferencesStore((s) => s.setAiMode);
  const browserAI = useBrowserAI();

  const canUseLocal =
    browserAI.status === "ready" || browserAI.status === "downloadable";
  const isDownloading = browserAI.status === "downloading";

  const handleModeChange = (value: string) => {
    setAiMode(value as AiModePreference);
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void browserAI.initialize();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button variant="ghost" size="sm" className={cn("group", className)}>
            {aiMode === "local" ||
            (aiMode === "auto" && browserAI.status === "ready") ? (
              <IconBrandChrome className="size-4 text-foreground/70 group-hover:text-foreground" />
            ) : (
              <IconCloud className="size-4 text-foreground/70 group-hover:text-foreground" />
            )}
            <span className="truncate text-[12.5px] text-foreground/80 leading-none group-hover:text-foreground">
              {aiMode === "cloud"
                ? "Cloud"
                : aiMode === "local"
                  ? "Browser"
                  : "Auto"}
            </span>
            <IconChevronDown className="size-3 text-muted-foreground transition-transform duration-200 group-data-[pressed]:rotate-180" />
          </Button>
        }
      />

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="sr-only">AI Provider</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={aiMode}
            onValueChange={handleModeChange}
          >
            <DropdownMenuRadioItem value="cloud">
              <IconCloud className="translate-y-[2px] self-start text-muted-foreground" />
              <div className="flex flex-col">
                <span>Cloud</span>
                <span className="text-muted-foreground text-xs">
                  Best quality, less private
                </span>
              </div>
            </DropdownMenuRadioItem>

            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                closeDelay={300}
                nativeButton={false}
                render={
                  <DropdownMenuRadioItem
                    value="local"
                    disabled={!canUseLocal && !isDownloading}
                  >
                    <IconBrandChrome className="translate-y-[2px] self-start text-muted-foreground" />
                    <div className="flex flex-1 flex-col">
                      <span>Local</span>
                      <span className="text-muted-foreground text-xs">
                        {browserAI.status === "unavailable" ||
                        browserAI.status === "ready"
                          ? "Fast & private, but dumber"
                          : getStatusLabel(
                              browserAI.status,
                              browserAI.downloadProgress,
                            )}
                      </span>
                    </div>
                    {browserAI.status === "downloadable" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 px-2"
                        onClick={handleDownloadClick}
                      >
                        <IconDownload className="size-3.5" />
                      </Button>
                    )}
                  </DropdownMenuRadioItem>
                }
              />
              <ResponsiveTooltipContent className={cn(canUseLocal && "hidden")}>
                Requires latest{" "}
                <a
                  href="https://developer.chrome.com/docs/ai/prompt-api"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Chrome
                </a>{" "}
                or{" "}
                <a
                  href="https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Microsoft Edge
                </a>{" "}
                on supported systems.
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>

            <DropdownMenuRadioItem value="auto" disabled={!canUseLocal}>
              <IconArrowFork className="translate-y-[2px] self-start text-muted-foreground" />
              <div className="flex flex-col">
                <span>Auto</span>
                <span className="text-muted-foreground text-xs">
                  Use local when available
                </span>
              </div>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
