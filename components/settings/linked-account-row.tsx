"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Spinner } from "@/components/ui/spinner";
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

  if (!provider.enabled) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4" />
        <span className="font-medium text-sm leading-none">
          {provider.name}
        </span>
      </div>

      {isLinked ? (
        <ResponsiveTooltip>
          <ResponsiveTooltipTrigger
            render={
              <Button
                variant="secondary"
                size="sm"
                onClick={canUnlink ? onUnlink : undefined}
                disabled={isLoading}
                className={cn(
                  "cursor-pointer",
                  !canUnlink && "cursor-default opacity-50",
                )}
              >
                {isUnlinking && <Spinner />}
                Unlink
              </Button>
            }
          />
          {!canUnlink && (
            <ResponsiveTooltipContent>
              You must have at least one linked account to sign in
            </ResponsiveTooltipContent>
          )}
        </ResponsiveTooltip>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onLink}
          disabled={isLoading}
          className="cursor-pointer"
        >
          {isLinking && <Spinner />}
          Link
        </Button>
      )}
    </div>
  );
}
