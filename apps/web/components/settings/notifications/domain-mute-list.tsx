"use client";

import { IconPlus, IconWorld, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Favicon } from "@/components/icons/favicon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MutableDomain {
  id: string;
  domainName: string;
  muted: boolean;
}

interface DomainMuteListProps {
  domains: MutableDomain[];
  onToggleMuted: (domainId: string, muted: boolean) => void;
  disabled?: boolean;
}

/**
 * Chip-based mute picker.
 * Shows muted domains as chips with X to unmute.
 * Plus button opens dropdown to mute additional domains.
 */
export function DomainMuteList({
  domains,
  onToggleMuted,
  disabled = false,
}: DomainMuteListProps) {
  const [isOpen, setIsOpen] = useState(false);

  const mutedDomains = domains.filter((d) => d.muted);
  const unmutedDomains = domains.filter((d) => !d.muted);

  // Empty state: no verified domains at all
  if (domains.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/10 px-4 py-6">
        <IconWorld className="size-5 text-muted-foreground/50" />
        <p className="text-muted-foreground text-sm">
          Verify domains to customize their notification settings.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Muted domain chips */}
      {mutedDomains.map((domain) => (
        <MutedDomainChip
          key={domain.id}
          domain={domain}
          onUnmute={() => onToggleMuted(domain.id, false)}
          disabled={disabled}
        />
      ))}

      {/* Add button with dropdown */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          disabled={disabled || unmutedDomains.length === 0}
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-dashed px-3.5"
            >
              <IconPlus className="size-3.5" />
              <span
                className={cn(
                  mutedDomains.length > 0
                    ? "sr-only"
                    : "text-[13px] text-foreground/80",
                )}
              >
                Mute domain
              </span>
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
          {unmutedDomains.map((domain) => (
            <DropdownMenuItem
              key={domain.id}
              onClick={() => {
                onToggleMuted(domain.id, true);
                setIsOpen(false);
              }}
            >
              <Favicon domain={domain.domainName} />
              {domain.domainName}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface MutedDomainChipProps {
  domain: MutableDomain;
  onUnmute: () => void;
  disabled?: boolean;
}

function MutedDomainChip({ domain, onUnmute, disabled }: MutedDomainChipProps) {
  return (
    <div className="group flex h-8 items-center gap-1.5 rounded-full border bg-muted/40 pr-1.5 pl-3.5 transition-colors hover:bg-muted/60">
      <Favicon
        domain={domain.domainName}
        className="mr-0.5 size-3.5 shrink-0"
      />
      <span className="max-w-32 truncate font-medium text-[13px]">
        {domain.domainName}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onUnmute}
        disabled={disabled}
        className="rounded-full"
        aria-label={`Unmute ${domain.domainName}`}
      >
        <IconX className="size-3" />
      </Button>
    </div>
  );
}
