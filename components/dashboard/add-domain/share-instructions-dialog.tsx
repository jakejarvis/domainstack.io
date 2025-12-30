"use client";

import { useMutation } from "@tanstack/react-query";
import clipboardCopy from "clipboard-copy";
import {
  Check,
  CircleX,
  ClipboardCheck,
  Copy,
  Download,
  Mail,
  Share2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { logger } from "@/lib/logger/client";
import type { VerificationInstructions } from "@/lib/schemas";
import { useTRPC } from "@/lib/trpc/client";

type ShareInstructionsDialogProps = {
  domain: string;
  instructions: VerificationInstructions;
  trackedDomainId: string;
};

/**
 * Formats all verification instructions into a plain text format
 * suitable for sharing with IT or via email.
 */
function formatInstructionsForSharing(
  domain: string,
  instructions: VerificationInstructions,
): string {
  const { dns_txt, html_file, meta_tag } = instructions;

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

Note: DNS changes may take up to 48 hours to propagate.

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
  instructions: VerificationInstructions,
): { success: true } | { success: false; error: unknown } {
  try {
    const content = formatInstructionsForSharing(domain, instructions);
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
  } catch (error) {
    return { success: false, error };
  }
}

export function ShareInstructionsDialog({
  domain,
  instructions,
  trackedDomainId,
}: ShareInstructionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    onSuccess: () => {
      setEmailSent(true);
      toast.success("Instructions sent!", {
        description: `Email sent to ${email}`,
      });
      // Reset after a delay
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setEmailSent(false);
        setEmail("");
      }, 3000);
    },
    onError: (error) => {
      logger.error("Failed to send verification instructions", error);
      toast.error("Failed to send email", {
        description: "Please try again or use another method.",
      });
    },
  });

  const handleCopy = async () => {
    try {
      const formattedText = formatInstructionsForSharing(domain, instructions);
      await clipboardCopy(formattedText);
      setCopied(true);
      toast.success("Copied!", {
        description: "Instructions copied to clipboard.",
        icon: <ClipboardCheck className="h-4 w-4" />,
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error("Failed to copy instructions to clipboard", error);
      toast.error("Failed to copy", {
        icon: <CircleX className="h-4 w-4" />,
      });
    }
  };

  const handleDownload = () => {
    const result = downloadInstructionsFile(domain, instructions);
    if (result.success) {
      toast.success("Instructions downloaded!", {
        description: "Send this file to your domain admin.",
      });
    } else {
      logger.error("Failed to download instructions file", result.error);
      toast.error("Failed to download file");
    }
  };

  const handleSendEmail = () => {
    if (!email.trim()) return;
    sendEmailMutation.mutate({
      trackedDomainId,
      recipientEmail: email.trim(),
    });
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset state when dialog closes
      setEmail("");
      setEmailSent(false);
      setCopied(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Share2 />
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

        <div className="space-y-4 pt-2">
          {/* Option 1: Copy to clipboard */}
          <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Copy className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">Copy to clipboard</p>
              <p className="text-muted-foreground text-xs">
                Copy all instructions as text
              </p>
            </div>
            <Button variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="text-green-600" /> : <Copy />}
              <span className="hidden sm:inline">
                {copied ? "Copied" : "Copy"}
              </span>
            </Button>
          </div>

          {/* Option 2: Download as file */}
          <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Download className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">Download as file</p>
              <p className="text-muted-foreground text-xs">
                Save as a text file to send
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="shrink-0"
            >
              <Download />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>

          {/* Option 3: Send via email */}
          <div className="rounded-lg border border-border/50 p-3">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Mail className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Send via email</p>
                <p className="text-muted-foreground text-xs">
                  We&apos;ll send instructions on your behalf
                </p>
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor="email" className="sr-only">
                Email address
              </FieldLabel>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    id="email"
                    type="email"
                    placeholder={`admin@${domain}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isValidEmail) {
                        handleSendEmail();
                      }
                    }}
                    disabled={sendEmailMutation.isPending || emailSent}
                  />
                </div>
                <Button
                  onClick={handleSendEmail}
                  variant="outline"
                  disabled={
                    !isValidEmail || sendEmailMutation.isPending || emailSent
                  }
                  className="shrink-0"
                >
                  {sendEmailMutation.isPending ? (
                    <>
                      <Spinner />
                      <span className="hidden sm:inline">Sending...</span>
                    </>
                  ) : emailSent ? (
                    <>
                      <Check />
                      <span className="hidden sm:inline">Sent!</span>
                    </>
                  ) : (
                    <>
                      <Mail />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </Button>
              </div>
            </Field>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
