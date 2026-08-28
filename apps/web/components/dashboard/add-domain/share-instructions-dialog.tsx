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
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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

// ============================================================================
// Types
// ============================================================================

type ShareInstructionsDialogProps = {
  domain: string;
  verificationToken: string;
  trackedDomainId: string;
};

// ============================================================================
// State Machine
// ============================================================================

/**
 * State machine for the share dialog.
 * Models the copy and email flows as explicit states.
 */
type ShareDialogState = {
  /** Whether the dialog is open */
  open: boolean;
  /** Copy to clipboard state */
  copyStatus: "idle" | "copied";
  /** Email form state */
  emailStatus: "idle" | "sending" | "sent";
  /** Current email input value */
  email: string;
};

type ShareDialogAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SET_EMAIL"; email: string }
  | { type: "COPY_SUCCESS" }
  | { type: "COPY_RESET" }
  | { type: "EMAIL_SENDING" }
  | { type: "EMAIL_SENT" }
  | { type: "EMAIL_ERROR" }
  | { type: "EMAIL_RESET" };

const initialState: ShareDialogState = {
  open: false,
  copyStatus: "idle",
  emailStatus: "idle",
  email: "",
};

function shareDialogReducer(state: ShareDialogState, action: ShareDialogAction): ShareDialogState {
  switch (action.type) {
    case "OPEN":
      return { ...state, open: true };

    case "CLOSE":
      // Reset everything when dialog closes
      return initialState;

    case "SET_EMAIL":
      return { ...state, email: action.email };

    case "COPY_SUCCESS":
      return { ...state, copyStatus: "copied" };

    case "COPY_RESET":
      return { ...state, copyStatus: "idle" };

    case "EMAIL_SENDING":
      return { ...state, emailStatus: "sending" };

    case "EMAIL_SENT":
      return { ...state, emailStatus: "sent" };

    case "EMAIL_ERROR":
      return { ...state, emailStatus: "idle" };

    case "EMAIL_RESET":
      return { ...state, emailStatus: "idle", email: "" };

    default:
      return state;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Downloads the instructions as a text file.
 */
function downloadInstructionsFile(domain: string, verificationToken: string): { success: boolean } {
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
}: ShareInstructionsDialogProps) {
  const [state, dispatch] = useReducer(shareDialogReducer, initialState);
  const [emailError, setEmailError] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const trpc = useTRPC();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const sendEmailMutation = useMutation({
    ...trpc.tracking.sendVerificationInstructions.mutationOptions(),
    onMutate: () => {
      dispatch({ type: "EMAIL_SENDING" });
      return undefined;
    },
    onSuccess: () => {
      dispatch({ type: "EMAIL_SENT" });
      toast.success("Instructions sent!", {
        description: `Email sent to ${state.email.trim()}`,
      });
      // Reset after a delay
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        dispatch({ type: "EMAIL_RESET" });
      }, 3000);
    },
    onError: () => {
      // Keep the typed email so the user can retry without re-entering it
      dispatch({ type: "EMAIL_ERROR" });
      toast.error("Failed to send email", {
        description: "Please try again or use another method.",
      });
    },
  });

  const handleDownload = useCallback(() => {
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
  }, [domain, verificationToken]);

  const handleSendEmail = useCallback(() => {
    const trimmed = state.email.trim();
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
    sendEmailMutation.mutate({
      trackedDomainId,
      recipientEmail: trimmed,
    });
  }, [state.email, trackedDomainId, sendEmailMutation]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      dispatch({ type: "OPEN" });
    } else {
      setEmailError("");
      dispatch({ type: "CLOSE" });
    }
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailError("");
    dispatch({ type: "SET_EMAIL", email: e.target.value });
  }, []);

  // Derived state
  const isEmailSending = state.emailStatus === "sending";
  const isEmailSent = state.emailStatus === "sent";
  const isEmailDisabled = isEmailSending || isEmailSent;

  return (
    <Dialog open={state.open} onOpenChange={handleOpenChange}>
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
                    value={state.email}
                    onChange={handleEmailChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isEmailSending && !isEmailSent) {
                        e.preventDefault();
                        handleSendEmail();
                      }
                    }}
                    disabled={isEmailSending || isEmailSent}
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
