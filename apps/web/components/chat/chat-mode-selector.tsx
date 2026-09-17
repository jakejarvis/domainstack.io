"use client";

import {
  IconArrowFork,
  IconCloud,
  IconDeviceLaptop,
  IconDownload,
  type TablerIcon,
} from "@tabler/icons-react";

import { type BrowserAIStatus, type UseBrowserAIResult } from "@/hooks/use-browser-ai";
import { type AiModePreference, usePreferencesStore } from "@/lib/stores/preferences-store";
import { Button } from "@domainstack/ui/button";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@domainstack/ui/select";
import { cn } from "@domainstack/ui/utils";

interface ChatModeSelectorProps {
  className?: string;
  disabled?: boolean;
  browserAI: UseBrowserAIResult;
}

interface ChatModeOption {
  value: AiModePreference;
  label: string;
  triggerLabel: string;
  icon: TablerIcon;
  getDescription: (browserAI: UseBrowserAIResult) => string;
  getTriggerIcon: (browserAI: UseBrowserAIResult) => TablerIcon;
  isDisabled: (browserAI: UseBrowserAIResult) => boolean;
}

function getStatusLabel(status: BrowserAIStatus, downloadProgress?: number): string {
  switch (status) {
    case "checking":
      return "Checking…";
    case "downloadable":
      return "Download required";
    case "downloading":
      return `Downloading… ${Math.round((downloadProgress ?? 0) * 100)}%`;
    case "error":
      return "Error";
    case "ready":
    case "unavailable":
      return "";
  }
}

function canUseLocal(status: BrowserAIStatus): boolean {
  return status === "ready" || status === "downloadable";
}

const MODE_OPTIONS = {
  cloud: {
    value: "cloud",
    label: "Cloud",
    triggerLabel: "Cloud",
    icon: IconCloud,
    getDescription: () => "Best quality, less private",
    getTriggerIcon: () => IconCloud,
    isDisabled: () => false,
  },
  local: {
    value: "local",
    label: "Local",
    triggerLabel: "Browser",
    icon: IconDeviceLaptop,
    getDescription: (browserAI) =>
      browserAI.status === "unavailable" || browserAI.status === "ready"
        ? "Fast & private, but dumber"
        : getStatusLabel(browserAI.status, browserAI.downloadProgress),
    getTriggerIcon: () => IconDeviceLaptop,
    isDisabled: (browserAI) => !canUseLocal(browserAI.status) && browserAI.status !== "downloading",
  },
  auto: {
    value: "auto",
    label: "Auto",
    triggerLabel: "Auto",
    icon: IconArrowFork,
    getDescription: () => "Use local when available",
    getTriggerIcon: (browserAI) => (browserAI.status === "ready" ? IconDeviceLaptop : IconCloud),
    isDisabled: (browserAI) => !canUseLocal(browserAI.status),
  },
} satisfies Record<AiModePreference, ChatModeOption>;

const MODE_OPTION_LIST = Object.values(MODE_OPTIONS);

export function ChatModeSelector({ className, disabled, browserAI }: ChatModeSelectorProps) {
  const aiMode = usePreferencesStore((s) => s.aiMode);
  const setAiMode = usePreferencesStore((s) => s.setAiMode);
  const selectedMode = MODE_OPTIONS[aiMode];

  const handleModeChange = (option: ChatModeOption | null) => {
    if (option !== null) setAiMode(option.value);
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void browserAI.initialize();
  };

  return (
    <Select<ChatModeOption>
      value={selectedMode}
      onValueChange={handleModeChange}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label="AI Provider"
        className={cn(
          "group cursor-pointer justify-center gap-1.5 border-transparent px-2.5 py-0 font-medium shadow-none transition-all select-none not-data-[disabled]:hover:bg-muted not-data-[disabled]:hover:text-foreground",
          "dark:bg-transparent dark:not-data-[disabled]:hover:bg-muted/50",
          "[&>[data-slot=select-icon]>svg]:size-3 [&>[data-slot=select-icon]>svg]:text-muted-foreground [&>[data-slot=select-icon]>svg]:transition-transform [&>[data-slot=select-icon]>svg]:duration-200 [&[data-popup-open]>[data-slot=select-icon]>svg]:rotate-180",
          className,
        )}
      >
        <SelectValue className="gap-1.5">
          {(option: ChatModeOption) => {
            const TriggerIcon = option.getTriggerIcon(browserAI);
            return (
              <>
                <TriggerIcon className="size-4 text-foreground/70 group-hover:text-foreground" />
                <span className="truncate text-[12.5px] leading-none text-foreground/80 group-hover:text-foreground">
                  {option.triggerLabel}
                </span>
              </>
            );
          }}
        </SelectValue>
      </SelectTrigger>

      <SelectContent align="start" alignItemWithTrigger={false} className="w-56 duration-100">
        <SelectGroup>
          <SelectLabel className="sr-only">AI Provider</SelectLabel>
          {MODE_OPTION_LIST.map((option) => {
            const OptionIcon = option.icon;
            const item = (
              <SelectItem
                key={option.value}
                value={option}
                label={option.label}
                disabled={option.isDisabled(browserAI)}
                className={cn(
                  "data-[highlighted]:**:text-accent-foreground",
                  "data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed",
                )}
              >
                <OptionIcon className="translate-y-[2px] self-start text-muted-foreground" />
                <div className="flex flex-1 flex-col">
                  <span className="text-[13px] font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.getDescription(browserAI)}
                  </span>
                </div>
                {option.value === "local" && browserAI.status === "downloadable" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2"
                    aria-label="Download on-device model"
                    onClick={handleDownloadClick}
                  >
                    <IconDownload className="size-3.5" />
                  </Button>
                )}
              </SelectItem>
            );

            if (option.value !== "local") return item;

            return (
              <ResponsiveTooltip key={option.value}>
                <ResponsiveTooltipTrigger closeDelay={300} nativeButton={false} render={item} />
                <ResponsiveTooltipContent
                  className={cn(browserAI.status !== "unavailable" && "hidden")}
                >
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
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
