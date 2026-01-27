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
  isUnlinking: boolean;
  onLink: () => void;
  onUnlink: () => void;
}

export function LinkedAccountRow({
  provider,
  isLinked,
  canUnlink,
  isLinking,
  isUnlinking,
  onLink,
  onUnlink,
}: LinkedAccountRowProps) {
  const Icon = provider.icon;
  const isLoading = isLinking || isUnlinking;

  if (!provider.enabled) {
    return null;
  }

  return (
    <Item size="default" variant="outline">
      <ItemMedia variant="icon" className="mx-1">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{provider.name}</ItemTitle>
      </ItemContent>

      <ItemActions>
        {isLinked ? (
          <ResponsiveTooltip>
            <ResponsiveTooltipTrigger
              nativeButton={false}
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
