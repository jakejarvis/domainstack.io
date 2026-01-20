"use client";

import { SmileyXEyesIcon, WrenchIcon } from "@phosphor-icons/react";
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
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
          <DialogDescription>Personalize your AI experience.</DialogDescription>
        </DialogHeader>
        <ItemGroup className="[&_[data-slot=item-media]]:!translate-y-[-1px] [&_[data-slot=item]]:!pr-4 [&_[data-slot=item]]:!pl-2 space-y-3 pb-1 [&_[data-slot=item-content]]:gap-0 [&_[data-slot=item]]:justify-between">
          <Item size="sm" variant="outline">
            <Label htmlFor="show-tool-calls" className="cursor-pointer">
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
            <Label htmlFor="hide-ai" className="cursor-pointer">
              <ItemMedia variant="icon">
                <SmileyXEyesIcon />
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
