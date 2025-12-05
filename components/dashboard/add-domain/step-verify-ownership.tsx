"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  VerificationInstructions,
  VerificationMethod,
} from "@/lib/schemas";
import type { VerificationState } from "./add-domain-dialog";
import { VerificationFailed } from "./verification-failed";
import {
  DnsVerificationInstructions,
  HtmlFileVerificationInstructions,
  MetaTagVerificationInstructions,
} from "./verification-instructions";

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
  const hasFailed = verificationState.status === "failed";

  // If verification has failed, show the troubleshooting UI
  if (hasFailed) {
    return (
      <VerificationFailed
        method={method}
        error={verificationState.error}
        isVerifying={isVerifying}
        onCheckAgain={onVerify}
        onReturnLater={onReturnLater}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={method}
        onValueChange={(v) => setMethod(v as VerificationMethod)}
      >
        <TabsList className="grid h-10 w-full grid-cols-3 bg-secondary/70 p-1">
          <TabsTrigger
            value="dns_txt"
            disabled={isVerifying}
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            DNS Record
          </TabsTrigger>
          <TabsTrigger
            value="html_file"
            disabled={isVerifying}
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            HTML File
          </TabsTrigger>
          <TabsTrigger
            value="meta_tag"
            disabled={isVerifying}
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Meta Tag
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dns_txt" className="mt-4 space-y-3">
          <DnsVerificationInstructions instructions={instructions.dns_txt} />
        </TabsContent>

        <TabsContent value="html_file" className="mt-4 space-y-3">
          <HtmlFileVerificationInstructions
            instructions={instructions.html_file}
          />
        </TabsContent>

        <TabsContent value="meta_tag" className="mt-4 space-y-3">
          <MetaTagVerificationInstructions
            instructions={instructions.meta_tag}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
