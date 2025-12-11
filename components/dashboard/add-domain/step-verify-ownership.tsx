"use client";

import clipboardCopy from "clipboard-copy";
import { CircleX, ClipboardCheck, Share2 } from "lucide-react";
import { toast } from "sonner";
import { VerificationFailed } from "@/components/dashboard/add-domain/verification-failed";
import { DnsVerificationInstructions } from "@/components/dashboard/add-domain/verification-instructions/dns-instructions";
import { HtmlFileVerificationInstructions } from "@/components/dashboard/add-domain/verification-instructions/html-file-instructions";
import { MetaTagVerificationInstructions } from "@/components/dashboard/add-domain/verification-instructions/meta-tag-instructions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { VerificationState } from "@/hooks/use-domain-verification";
import { logger } from "@/lib/logger/client";
import type {
  VerificationInstructions,
  VerificationMethod,
} from "@/lib/schemas";

/**
 * Formats all verification instructions into a plain text format
 * suitable for sharing with IT or via email.
 */
function formatInstructionsForSharing(
  instructions: VerificationInstructions,
): string {
  const { dns_txt, html_file, meta_tag } = instructions;

  // Extract domain from DNS hostname (e.g., "_domainstack-verify.example.com" -> "example.com")
  const dotIndex = dns_txt.hostname.indexOf(".");
  const domain = dotIndex > 0 ? dns_txt.hostname.slice(dotIndex + 1) : "";

  return `Domain Verification Instructions for ${domain}
${"=".repeat(50)}

Please complete ONE of the following verification methods to verify ownership of ${domain}.

${"─".repeat(50)}
OPTION 1: DNS TXT Record (Recommended)
${"─".repeat(50)}
Add a TXT record to your domain's DNS settings:

  Host/Name:  ${dns_txt.hostname.slice(0, dotIndex)}
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

Once completed, return to DomainStack to verify ownership.
`;
}

type StepVerifyOwnershipProps = {
  method: VerificationMethod;
  setMethod: (m: VerificationMethod) => void;
  instructions: VerificationInstructions;
  verificationState: VerificationState;
  onVerify: () => void;
  onReturnLater: () => void;
};

export function StepVerifyOwnership({
  method,
  setMethod,
  instructions,
  verificationState,
  onVerify,
  onReturnLater,
}: StepVerifyOwnershipProps) {
  const isVerifying = verificationState.status === "verifying";

  const handleCopyAllInstructions = async () => {
    try {
      const formattedText = formatInstructionsForSharing(instructions);
      await clipboardCopy(formattedText);
      toast.success("Instructions copied!", {
        description: "All verification methods copied to clipboard.",
        icon: <ClipboardCheck className="h-4 w-4" />,
      });
    } catch (error) {
      logger.error("Failed to copy instructions to clipboard", error);
      toast.error("Failed to copy", {
        icon: <CircleX className="h-4 w-4" />,
      });
    }
  };

  // If verification has failed, show the troubleshooting UI
  if (verificationState.status === "failed") {
    return (
      <VerificationFailed
        method={method}
        onCheckAgain={onVerify}
        onReturnLater={onReturnLater}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <Tabs
        value={method}
        onValueChange={(v) => setMethod(v as VerificationMethod)}
      >
        <div className="flex items-center justify-between gap-2">
          <TabsList className="grid h-10 w-full grid-cols-3 border border-border bg-muted/50 p-1 dark:border-white/15 dark:bg-white/5">
            <TabsTrigger
              value="dns_txt"
              disabled={isVerifying}
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/15"
            >
              DNS Record
            </TabsTrigger>
            <TabsTrigger
              value="html_file"
              disabled={isVerifying}
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/15"
            >
              HTML File
            </TabsTrigger>
            <TabsTrigger
              value="meta_tag"
              disabled={isVerifying}
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/15"
            >
              Meta Tag
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dns_txt" className="mt-1 min-w-0 space-y-3">
          <DnsVerificationInstructions instructions={instructions.dns_txt} />
        </TabsContent>

        <TabsContent value="html_file" className="mt-1 min-w-0 space-y-3">
          <HtmlFileVerificationInstructions
            instructions={instructions.html_file}
          />
        </TabsContent>

        <TabsContent value="meta_tag" className="mt-1 min-w-0 space-y-3">
          <MetaTagVerificationInstructions
            instructions={instructions.meta_tag}
          />
        </TabsContent>
      </Tabs>

      {/* Share with IT - for non-technical users to forward to their IT team */}
      <div className="flex justify-center border-border/50 border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyAllInstructions}
          className="h-auto cursor-pointer gap-1.5 px-2 py-1 text-muted-foreground text-xs hover:text-foreground"
        >
          <Share2 className="size-3" />
          Copy all instructions to share with IT
        </Button>
      </div>
    </div>
  );
}
