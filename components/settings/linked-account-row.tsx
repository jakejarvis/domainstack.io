"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OAuthProviderConfig } from "@/lib/constants/oauth-providers";
import { cn } from "@/lib/utils";

interface LinkedAccountRowProps {
  provider: OAuthProviderConfig;
  isLinked: boolean;
  canUnlink: boolean;
  isLinking: boolean;
  unlinkMutation: UseMutationResult<unknown, Error, string, unknown>;
  onLink: () => void;
  onUnlink: () => void;
}

export function LinkedAccountRow({
  provider,
  isLinked,
  canUnlink,
  isLinking,
  unlinkMutation,
  onLink,
  onUnlink,
}: LinkedAccountRowProps) {
  const Icon = provider.icon;
  const isUnlinking =
    unlinkMutation.isPending && unlinkMutation.variables === provider.id;
  const isLoading = isLinking || isUnlinking;

  return (
    <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4" />
        <span className="font-medium text-sm leading-none">
          {provider.name}
        </span>
      </div>

      {!provider.enabled ? (
        <Button variant="secondary" size="sm" disabled>
          Unavailable
        </Button>
      ) : isLinked ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onUnlink}
                  disabled={!canUnlink || isLoading}
                  className={cn(
                    "gap-2",
                    canUnlink ? "cursor-pointer" : "cursor-not-allowed",
                  )}
                >
                  {isUnlinking && <Loader2 className="size-4 animate-spin" />}
                  Unlink
                </Button>
              </span>
            }
          />
          {!canUnlink && (
            <TooltipContent>
              You must have at least one linked account to sign in
            </TooltipContent>
          )}
        </Tooltip>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onLink}
          disabled={isLoading}
          className={cn(
            "gap-2",
            isLinking ? "cursor-not-allowed" : "cursor-pointer",
          )}
        >
          {isLinking && <Loader2 className="size-4 animate-spin" />}
          Link
        </Button>
      )}
    </div>
  );
}
