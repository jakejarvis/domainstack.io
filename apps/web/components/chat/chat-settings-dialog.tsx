"use client";

import { IconBiohazard, IconBrain, IconInfoCircle, IconTool } from "@tabler/icons-react";

import { BetaBadge } from "@/components/beta-badge";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { CHATBOT_NAME } from "@domainstack/constants";
import { Button } from "@domainstack/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@domainstack/ui/dialog";
import { Field, FieldLabel } from "@domainstack/ui/field";
import { Icon } from "@domainstack/ui/icon";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@domainstack/ui/item";
import { Switch } from "@domainstack/ui/switch";

export interface ChatSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SettingsSwitchRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Item size="xs" variant="outline">
      <Field className="w-full min-w-0">
        <FieldLabel className="flex w-full min-w-0 cursor-pointer items-center font-normal select-none">
          <ItemMedia variant="icon">
            <Icon variant="muted" size="sm">
              {icon}
            </Icon>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{title}</ItemTitle>
            <ItemDescription>{description}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
          </ItemActions>
        </FieldLabel>
      </Field>
    </Item>
  );
}

export function ChatSettingsDialog({ open, onOpenChange }: ChatSettingsDialogProps) {
  const hideAiFeatures = usePreferencesStore((s) => s.hideAiFeatures);
  const setHideAiFeatures = usePreferencesStore((s) => s.setHideAiFeatures);
  const showToolCalls = usePreferencesStore((s) => s.showToolCalls);
  const setShowToolCalls = usePreferencesStore((s) => s.setShowToolCalls);
  const showReasoning = usePreferencesStore((s) => s.showReasoning);
  const setShowReasoning = usePreferencesStore((s) => s.setShowReasoning);

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
        <ItemGroup className="space-y-1 pb-1">
          <SettingsSwitchRow
            icon={<IconTool />}
            title="Show tool calls"
            description="Display the underlying API requests & responses"
            checked={showToolCalls}
            onCheckedChange={setShowToolCalls}
          />
          <SettingsSwitchRow
            icon={<IconBrain />}
            title="Show reasoning"
            description={`Reveals ${CHATBOT_NAME}\u2019s thought process`}
            checked={showReasoning}
            onCheckedChange={setShowReasoning}
          />
          <SettingsSwitchRow
            icon={<IconBiohazard />}
            title="Disable AI"
            description={
              hideAiFeatures ? (
                <>
                  To restore, visit any page with{" "}
                  <code className="rounded bg-muted px-1 text-[11px]">?show_ai=1</code>
                </>
              ) : (
                <>Removes all AI-powered features from all pages</>
              )
            }
            checked={hideAiFeatures}
            onCheckedChange={setHideAiFeatures}
          />
        </ItemGroup>
        <DialogFooter className="gap-2.5 sm:items-center sm:justify-between sm:gap-5">
          <div className="mx-auto flex items-start gap-1.5 pl-2 sm:mx-0 sm:gap-2 sm:pl-1">
            <IconInfoCircle className="size-3.5 translate-y-[3px] text-muted-foreground" />
            <p className="text-[13px] leading-normal text-muted-foreground">
              These preferences only apply to the current browser.
            </p>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:hidden">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
