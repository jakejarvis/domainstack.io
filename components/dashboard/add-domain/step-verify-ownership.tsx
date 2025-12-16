"use client";

import { VerificationFailed } from "@/components/dashboard/add-domain/verification-failed";
import { DnsVerificationInstructions } from "@/components/dashboard/add-domain/verification-instructions/dns-instructions";
import { HtmlFileVerificationInstructions } from "@/components/dashboard/add-domain/verification-instructions/html-file-instructions";
import { MetaTagVerificationInstructions } from "@/components/dashboard/add-domain/verification-instructions/meta-tag-instructions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { VerificationState } from "@/hooks/use-domain-verification";
import type {
  VerificationInstructions,
  VerificationMethod,
} from "@/lib/schemas";

type StepVerifyOwnershipProps = {
  method: VerificationMethod;
  setMethod: (m: VerificationMethod) => void;
  instructions: VerificationInstructions;
  verificationState: VerificationState;
  domain: string;
  trackedDomainId: string;
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
        <TabsList className="grid h-10 w-full grid-cols-3 border border-border bg-muted/50 p-1 dark:border-white/15 dark:bg-white/5">
          <TabsTrigger
            value="dns_txt"
            disabled={isVerifying}
            className="cursor-pointer data-[state=active]:cursor-default"
          >
            DNS Record
          </TabsTrigger>
          <TabsTrigger
            value="html_file"
            disabled={isVerifying}
            className="cursor-pointer data-[state=active]:cursor-default"
          >
            HTML File
          </TabsTrigger>
          <TabsTrigger
            value="meta_tag"
            disabled={isVerifying}
            className="cursor-pointer data-[state=active]:cursor-default"
          >
            Meta Tag
          </TabsTrigger>
        </TabsList>

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
    </div>
  );
}
