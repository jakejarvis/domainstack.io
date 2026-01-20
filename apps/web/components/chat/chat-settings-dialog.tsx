"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemContent,
  ItemDescription,
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
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Item size="sm" variant="default" className="rounded-lg p-0">
            <ItemContent>
              <ItemTitle>
                <Label htmlFor="show-tool-calls" className="cursor-pointer">
                  Show tool calls
                </Label>
              </ItemTitle>
              <ItemDescription className="text-xs">
                Display the underlying API calls in the conversation
              </ItemDescription>
            </ItemContent>
            <Switch
              id="show-tool-calls"
              checked={showToolCalls}
              onCheckedChange={setShowToolCalls}
            />
          </Item>
          <Item size="sm" variant="default" className="rounded-lg p-0">
            <ItemContent>
              <ItemTitle>
                <Label htmlFor="hide-ai" className="cursor-pointer">
                  Hide AI features
                </Label>
              </ItemTitle>
              <ItemDescription className="text-xs">
                {hideAiFeatures ? (
                  <>
                    To restore, visit any page with{" "}
                    <code className="rounded bg-muted px-1 text-[11px]">
                      ?show_ai=1
                    </code>
                  </>
                ) : (
                  <>Removes the chat button from all pages</>
                )}
              </ItemDescription>
            </ItemContent>
            <Switch
              id="hide-ai"
              checked={hideAiFeatures}
              onCheckedChange={setHideAiFeatures}
            />
          </Item>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
