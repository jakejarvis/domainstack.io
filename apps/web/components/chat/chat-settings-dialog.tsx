"use client";

import { BiohazardIcon, InfoIcon, WrenchIcon } from "@phosphor-icons/react";
import { BetaBadge } from "@/components/beta-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAiPreferences } from "@/hooks/use-ai-preferences";

export interface ChatSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSettingsDialog({
  open,
  onOpenChange,
}: ChatSettingsDialogProps) {
  const { hideAiFeatures, setHideAiFeatures, showToolCalls, setShowToolCalls } =
    useAiPreferences();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-0.5">
          <DialogTitle className="flex items-center gap-2">
            <span className="leading-none">Chat Settings</span>
            <BetaBadge className="translate-y-[-1px]" />
          </DialogTitle>
          <DialogDescription>Personalize your AI experience.</DialogDescription>
        </DialogHeader>
        <ItemGroup className="[&_[data-slot=item-media]]:!translate-y-[-1px] [&_[data-slot=item]]:!pr-4 [&_[data-slot=item]]:!pl-2 space-y-3 pb-1 [&_[data-slot=item-content]]:gap-0 [&_[data-slot=item]]:justify-between">
          <Item size="sm" variant="outline">
            <Label htmlFor="show-tool-calls" className="flex-1 cursor-pointer">
              <ItemMedia variant="icon">
                <WrenchIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Show tool calls</ItemTitle>
                <ItemDescription className="text-xs">
                  Display the underlying API calls in the conversation
                </ItemDescription>
              </ItemContent>
            </Label>
            <ItemActions>
              <Switch
                id="show-tool-calls"
                checked={showToolCalls}
                onCheckedChange={setShowToolCalls}
              />
            </ItemActions>
          </Item>
          <Item size="sm" variant="outline">
            <Label htmlFor="hide-ai" className="flex-1 cursor-pointer">
              <ItemMedia variant="icon">
                <BiohazardIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Disable AI</ItemTitle>
                <ItemDescription className="text-xs">
                  {hideAiFeatures ? (
                    <>
                      To restore, visit any page with{" "}
                      <code className="rounded bg-muted px-1 text-[11px]">
                        ?show_ai=1
                      </code>
                    </>
                  ) : (
                    <>Removes all AI-powered features from all pages</>
                  )}
                </ItemDescription>
              </ItemContent>
            </Label>
            <ItemActions>
              <Switch
                id="hide-ai"
                checked={hideAiFeatures}
                onCheckedChange={setHideAiFeatures}
              />
            </ItemActions>
          </Item>
        </ItemGroup>
        <DialogFooter className="gap-2.5 sm:items-center sm:justify-between sm:gap-5">
          <div className="mx-auto flex items-start gap-1.5 pl-2 sm:mx-0 sm:gap-2 sm:pl-1">
            <InfoIcon className="size-3.5 translate-y-[3px] text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground leading-normal">
              These preferences only apply to the current browser.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:hidden"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
