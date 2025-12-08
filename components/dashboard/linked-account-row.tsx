"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { Check, Link2, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OAuthProviderConfig } from "@/lib/constants/oauth-providers";

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

  return (
    <div className="flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-background">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{provider.name}</span>
            {isLinked && (
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-600 text-xs dark:text-green-400">
                <Check className="size-3" />
                Connected
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {isLinked
              ? "You can sign in with this account"
              : provider.enabled
                ? "Link to enable sign in"
                : "Not available"}
          </p>
        </div>
      </div>

      {isLinked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={onUnlink}
                disabled={!canUnlink || unlinkMutation.isPending}
                className="gap-2"
              >
                {isUnlinking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Unlink className="size-4" />
                )}
                Unlink
              </Button>
            </span>
          </TooltipTrigger>
          {!canUnlink && (
            <TooltipContent>
              You must have at least one linked account to sign in
            </TooltipContent>
          )}
        </Tooltip>
      ) : provider.enabled ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onLink}
          disabled={isLinking}
          className="gap-2"
        >
          {isLinking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link2 className="size-4" />
          )}
          Link
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled className="gap-2">
          <Link2 className="size-4" />
          Unavailable
        </Button>
      )}
    </div>
  );
}
