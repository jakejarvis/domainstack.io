import type { UseMutationResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Spinner } from "@/components/ui/spinner";
import type { OAuthProvider } from "@/lib/oauth";

interface LinkedAccountRowProps {
  provider: OAuthProvider;
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
    <Item size="sm" variant="outline">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{provider.name}</ItemTitle>
      </ItemContent>

      <ItemActions>
        {isLinked ? (
          <ResponsiveTooltip>
            <ResponsiveTooltipTrigger
              render={
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={canUnlink ? onUnlink : undefined}
                    disabled={isLoading || !canUnlink}
                  >
                    {isUnlinking && <Spinner />}
                    Unlink
                  </Button>
                </div>
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
          >
            {isLinking && <Spinner />}
            Link
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
