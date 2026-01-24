import {
  AtIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  PaperPlaneTiltIcon,
  ShareNetworkIcon,
} from "@phosphor-icons/react/ssr";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc/client";
import { buildVerificationInstructions } from "@/lib/verification-instructions";

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
  | { type: "EMAIL_RESET" };

const initialState: ShareDialogState = {
  open: false,
  copyStatus: "idle",
  emailStatus: "idle",
  email: "",
};

function shareDialogReducer(
  state: ShareDialogState,
  action: ShareDialogAction,
): ShareDialogState {
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
 * Formats all verification instructions into a plain text format
 * suitable for sharing with IT or via email.
 */
function formatInstructionsForSharing(
  domain: string,
  verificationToken: string,
): string {
  const { dns_txt, html_file, meta_tag } = buildVerificationInstructions(
    domain,
    verificationToken,
  );

  return `Domain Verification Instructions for ${domain}
${"=".repeat(50)}

Please complete ONE of the following verification methods to verify ownership of ${domain}.

${"─".repeat(50)}
OPTION 1: DNS TXT Record (Recommended)
${"─".repeat(50)}
Add a TXT record to your domain's DNS settings:

  Host/Name:  @ (${dns_txt.hostname})
  Type:       ${dns_txt.recordType}
  Value:      ${dns_txt.value}
  TTL:        ${dns_txt.suggestedTTL} (${dns_txt.suggestedTTLLabel})

Note: DNS changes may take up to 48\u00A0hours to propagate.

${"─".repeat(50)}
OPTION 2: HTML File Upload
${"─".repeat(50)}
Upload a file to your website:

  File Path:     ${html_file.fullPath}
  File Name:     ${html_file.filename}
  File Contents: ${html_file.fileContent}

The file must be accessible at: https://${domain}${html_file.fullPath}

${"─".repeat(50)}
OPTION 3: Meta Tag
${"─".repeat(50)}
Add this meta tag to your homepage's <head> section:

  ${meta_tag.metaTag}

${"─".repeat(50)}

Once completed, return to Domainstack to verify ownership.
`;
}

/**
 * Downloads the instructions as a text file.
 */
function downloadInstructionsFile(
  domain: string,
  verificationToken: string,
): { success: boolean } {
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trpc = useTRPC();

  // Cleanup timeout on unmount
  // biome-ignore lint/nursery/useConsistentArrowReturn: nesting is intentional
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
        description: `Email sent to ${state.email}`,
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
      // Reset to idle on error so user can retry
      dispatch({ type: "EMAIL_RESET" });
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
      toast.error("Failed to download file");
    }
  }, [domain, verificationToken]);

  const handleSendEmail = useCallback(() => {
    if (!state.email.trim()) return;
    sendEmailMutation.mutate({
      trackedDomainId,
      recipientEmail: state.email.trim(),
    });
  }, [state.email, trackedDomainId, sendEmailMutation]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      dispatch({ type: "OPEN" });
    } else {
      dispatch({ type: "CLOSE" });
    }
  }, []);

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: "SET_EMAIL", email: e.target.value });
    },
    [],
  );

  // Derived state
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim());
  const isEmailSending = state.emailStatus === "sending";
  const isEmailSent = state.emailStatus === "sent";
  const isEmailDisabled = !isValidEmail || isEmailSending || isEmailSent;

  return (
    <Dialog open={state.open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <ShareNetworkIcon />
            Share
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Verification Instructions</DialogTitle>
          <DialogDescription>
            Share these instructions with someone who manages your domain (e.g.,
            IT admin, web developer).
          </DialogDescription>
        </DialogHeader>

        <ItemGroup className="space-y-1">
          {/* Option 1: Copy to clipboard */}
          <Item size="xs" variant="outline">
            <ItemMedia variant="icon">
              <Icon variant="muted" size="sm">
                <CopyIcon />
              </Icon>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Copy to clipboard</ItemTitle>
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
                <FileTextIcon />
              </Icon>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Download as file</ItemTitle>
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
                <DownloadIcon aria-hidden="true" />
                Download
              </Button>
            </ItemActions>
          </Item>

          {/* Option 3: Send via email */}
          <Item size="xs" variant="outline">
            <ItemMedia variant="icon">
              <Icon variant="muted" size="sm">
                <AtIcon />
              </Icon>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Send via email</ItemTitle>
              <ItemDescription>
                We&apos;ll send instructions on your behalf
              </ItemDescription>
            </ItemContent>
            <ItemFooter>
              <Field>
                <FieldLabel htmlFor="email" className="sr-only">
                  Email address
                </FieldLabel>
                <div className="flex gap-2">
                  <InputGroup className="min-w-0 flex-1">
                    <InputGroupInput
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      placeholder={`admin@${domain}`}
                      value={state.email}
                      onChange={handleEmailChange}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          isValidEmail &&
                          !isEmailSending
                        ) {
                          handleSendEmail();
                        }
                      }}
                      disabled={isEmailSending || isEmailSent}
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
                          <CheckIcon aria-hidden="true" />
                        ) : (
                          <PaperPlaneTiltIcon aria-hidden="true" />
                        )}
                        Send
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </Field>
            </ItemFooter>
          </Item>
        </ItemGroup>
      </DialogContent>
    </Dialog>
  );
}
