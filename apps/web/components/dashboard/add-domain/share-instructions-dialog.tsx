import {
  IconAt,
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileText,
  IconSend,
  IconShare,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@domainstack/ui/button";
import { CopyButton } from "@domainstack/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@domainstack/ui/dialog";
import { Field, FieldError, FieldLabel } from "@domainstack/ui/field";
import { Icon } from "@domainstack/ui/icon";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@domainstack/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@domainstack/ui/item";
import { Spinner } from "@domainstack/ui/spinner";
import { formatInstructionsForSharing } from "@domainstack/utils/verification";

/** How long the Send button shows its checkmark before the form resets. */
const SENT_RESET_MS = 3000;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Downloads the instructions as a text file.
 */
interface DownloadInstructionsResult {
  success: boolean;
}

function downloadInstructionsFile(
  domain: string,
  verificationToken: string,
): DownloadInstructionsResult {
  try {
    const content = formatInstructionsForSharing(domain, verificationToken);
    const filename = `${domain}-verification-instructions.txt`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    // Delay cleanup to ensure the download starts before revoking the URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);

    return { success: true };
  } catch {
    return { success: false };
  }
}

// ============================================================================
// Component
// ============================================================================

export function ShareInstructionsDialog({
  domain,
  verificationToken,
  trackedDomainId,
}: {
  domain: string;
  verificationToken: string;
  trackedDomainId: string;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const trpc = useTRPC();

  useEffect(() => () => clearTimeout(resetTimerRef.current ?? undefined), []);

  // The mutation's own pending/success state drives the Send button; on error it
  // falls back to idle and keeps the typed email so the user can retry.
  const sendEmailMutation = useMutation({
    ...trpc.tracking.sendVerificationInstructions.mutationOptions(),
    onSuccess: (_data, { recipientEmail }) => {
      toast.success("Instructions sent!", { description: `Email sent to ${recipientEmail}` });
      clearTimeout(resetTimerRef.current ?? undefined);
      resetTimerRef.current = setTimeout(() => {
        sendEmailMutation.reset();
        setEmail("");
      }, SENT_RESET_MS);
    },
    onError: () => {
      toast.error("Failed to send email", {
        description: "Please try again or use another method.",
      });
    },
  });

  const handleDownload = () => {
    const result = downloadInstructionsFile(domain, verificationToken);
    if (result.success) {
      toast.success("Instructions downloaded!", {
        description: "Send this file to your domain admin.",
      });
    } else {
      toast.error("Failed to download file", {
        description: "Try again or copy the instructions instead.",
      });
    }
  };

  const handleSendEmail = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Enter an email address, like admin@example.com.");
      emailInputRef.current?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address, like admin@example.com.");
      emailInputRef.current?.focus();
      return;
    }
    setEmailError("");
    sendEmailMutation.mutate({ trackedDomainId, recipientEmail: trimmed });
  };

  // Closing starts the dialog fresh next time.
  const handleOpenChange = (open: boolean) => {
    if (open) return;
    clearTimeout(resetTimerRef.current ?? undefined);
    sendEmailMutation.reset();
    setEmail("");
    setEmailError("");
  };

  const isEmailSending = sendEmailMutation.isPending;
  const isEmailSent = sendEmailMutation.isSuccess;
  const isEmailDisabled = isEmailSending || isEmailSent;

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <IconShare aria-hidden />
            Share
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Verification Instructions</DialogTitle>
          <DialogDescription>
            Share these instructions with someone who manages your domain (e.g., IT admin, web
            developer).
          </DialogDescription>
        </DialogHeader>

        <ItemGroup className="space-y-1">
          {/* Option 1: Copy to clipboard */}
          <Item size="xs" variant="outline">
            <ItemMedia variant="icon">
              <Icon variant="muted" size="sm">
                <IconCopy aria-hidden />
              </Icon>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Copy to Clipboard</ItemTitle>
              <ItemDescription>Copy all instructions as text</ItemDescription>
            </ItemContent>
            <ItemActions>
              <CopyButton
                value={formatInstructionsForSharing(domain, verificationToken)}
                size="sm"
                variant="outline"
                className="px-2.5 text-[13px]"
                showLabel
              />
            </ItemActions>
          </Item>

          {/* Option 2: Download as file */}
          <Item size="xs" variant="outline">
            <ItemMedia variant="icon">
              <Icon variant="muted" size="sm">
                <IconFileText aria-hidden />
              </Icon>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Download as File</ItemTitle>
              <ItemDescription>Save as a text file for later</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                size="sm"
                variant="outline"
                className="px-2.5 text-[13px]"
                onClick={handleDownload}
                aria-label="Download instructions"
              >
                <IconDownload aria-hidden="true" />
                Download
              </Button>
            </ItemActions>
          </Item>

          {/* Option 3: Send via email */}
          <Item size="xs" variant="outline">
            <ItemMedia variant="icon">
              <Icon variant="muted" size="sm">
                <IconAt aria-hidden />
              </Icon>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Send via Email</ItemTitle>
              <ItemDescription>We&rsquo;ll send instructions on your behalf</ItemDescription>
            </ItemContent>
            <ItemFooter>
              <Field data-invalid={emailError ? true : undefined}>
                <FieldLabel className="sr-only">Email address</FieldLabel>
                <InputGroup className="min-w-0 flex-1">
                  <InputGroupInput
                    ref={emailInputRef}
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder={`admin@${domain}\u2026`}
                    value={email}
                    onChange={(e) => {
                      setEmailError("");
                      setEmail(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isEmailDisabled) {
                        e.preventDefault();
                        handleSendEmail();
                      }
                    }}
                    disabled={isEmailDisabled}
                    aria-invalid={emailError ? true : undefined}
                    data-1p-ignore
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      variant="ghost"
                      size="xs"
                      onClick={handleSendEmail}
                      disabled={isEmailDisabled}
                      aria-label="Send email"
                      className="gap-1.5 text-[13px]"
                    >
                      {isEmailSending ? (
                        <Spinner />
                      ) : isEmailSent ? (
                        <IconCheck aria-hidden="true" />
                      ) : (
                        <IconSend aria-hidden="true" />
                      )}
                      Send
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError>{emailError}</FieldError>
              </Field>
            </ItemFooter>
          </Item>
        </ItemGroup>
      </DialogContent>
    </Dialog>
  );
}
