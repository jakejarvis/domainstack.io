import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { VerificationFailed } from "@/components/dashboard/add-domain/verification-failed";
import { Button } from "@/components/ui/button";
import { CopyableField } from "@/components/ui/copyable-field";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { VerificationMethod } from "@/lib/constants/verification";
import type { VerificationState } from "@/lib/types/verification";
import { buildVerificationInstructions } from "@/lib/verification-instructions";

type StepVerifyOwnershipProps = {
  domain: string;
  verificationToken: string;
  method: VerificationMethod;
  setMethod: (m: VerificationMethod) => void;
  verificationState: VerificationState;
  onVerify: () => void;
  onReturnLater: () => void;
};

const VERIFICATION_METHODS = ["dns_txt", "html_file", "meta_tag"] as const;

function isVerificationMethod(value: string): value is VerificationMethod {
  return (VERIFICATION_METHODS as readonly string[]).includes(value);
}

function downloadVerificationFile(
  filename: string,
  content: string,
): { success: boolean } {
  try {
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
    }, 1000);

    return { success: true };
  } catch {
    return { success: false };
  }
}

function VerificationInstructionsLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-1 min-w-0 space-y-3">
      <div className="flex gap-3 rounded-lg border border-info-border bg-info p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-info-foreground" />
        <div className="space-y-0.5">
          <p className="font-medium text-info-foreground text-sm">{title}</p>
          <p className="text-info-foreground/80 text-sm">{description}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-input bg-muted/30 p-4">
        {children}
      </div>
    </div>
  );
}

export function StepVerifyOwnership({
  domain,
  verificationToken,
  method,
  setMethod,
  verificationState,
  onVerify,
  onReturnLater,
}: StepVerifyOwnershipProps) {
  const isVerifying = verificationState.status === "verifying";
  const instructions = buildVerificationInstructions(domain, verificationToken);

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
        onValueChange={(value) => {
          if (isVerificationMethod(value)) setMethod(value);
        }}
      >
        <TabsList className="grid h-10 grid-cols-3">
          <TabsTrigger value="dns_txt" disabled={isVerifying}>
            DNS Record
          </TabsTrigger>
          <TabsTrigger value="html_file" disabled={isVerifying}>
            HTML File
          </TabsTrigger>
          <TabsTrigger value="meta_tag" disabled={isVerifying}>
            Meta Tag
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dns_txt">
          <VerificationInstructionsLayout
            title={instructions.dns_txt.title}
            description={instructions.dns_txt.description}
          >
            <CopyableField label="Host / Name" value="@">
              <span>
                @
                <span className="select-none text-muted-foreground/85">
                  {" "}
                  ({instructions.dns_txt.hostname})
                </span>
              </span>
            </CopyableField>
            <CopyableField
              label="Type"
              value={instructions.dns_txt.recordType}
            />
            <CopyableField
              label="Value / Content"
              value={instructions.dns_txt.value}
            />
            <CopyableField
              label="TTL (recommended)"
              value={String(instructions.dns_txt.suggestedTTL)}
            >
              <span>
                {instructions.dns_txt.suggestedTTL}
                <span className="select-none text-muted-foreground/85">
                  {" "}
                  ({instructions.dns_txt.suggestedTTLLabel})
                </span>
              </span>
            </CopyableField>
          </VerificationInstructionsLayout>
        </TabsContent>

        <TabsContent value="html_file">
          <VerificationInstructionsLayout
            title={instructions.html_file.title}
            description={instructions.html_file.description}
          >
            <CopyableField
              label="Upload Path"
              value={instructions.html_file.fullPath}
            >
              <span className="inline-flex items-center gap-0.5">
                <span className="select-none text-muted-foreground/85">
                  https://{instructions.html_file.hostname}
                </span>
                {instructions.html_file.fullPath}
              </span>
            </CopyableField>
            <CopyableField
              label="File Contents"
              value={instructions.html_file.fileContent}
            />
            <Separator className="my-3 bg-border/60" />
            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const result = downloadVerificationFile(
                        instructions.html_file.filename,
                        instructions.html_file.fileContent,
                      );
                      if (result.success) {
                        toast.success("File downloaded!", {
                          description:
                            "Upload the file to your website at the path shown.",
                        });
                      } else {
                        toast.error("Failed to download file");
                      }
                    }}
                  >
                    <Download />
                    Download File
                  </Button>
                }
              />
              <ResponsiveTooltipContent>
                {instructions.html_file.filename}
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>
          </VerificationInstructionsLayout>
        </TabsContent>

        <TabsContent value="meta_tag">
          <VerificationInstructionsLayout
            title={instructions.meta_tag.title}
            description={instructions.meta_tag.description}
          >
            <CopyableField
              label="Meta Tag"
              value={instructions.meta_tag.metaTag}
            >
              {/* Syntax highlighted meta tag */}
              <span>
                <span className="text-zinc-500 dark:text-zinc-400">&lt;</span>
                <span className="text-rose-600 dark:text-rose-400">meta</span>
                <span className="text-sky-600 dark:text-sky-400"> name</span>
                <span className="text-zinc-500 dark:text-zinc-400">=</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  "domainstack-verify"
                </span>
                <span className="text-sky-600 dark:text-sky-400"> content</span>
                <span className="text-zinc-500 dark:text-zinc-400">=</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  "
                  {
                    instructions.meta_tag.metaTag.match(
                      /content="([^"]+)"/,
                    )?.[1]
                  }
                  "
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">&gt;</span>
              </span>
            </CopyableField>
          </VerificationInstructionsLayout>
        </TabsContent>
      </Tabs>
    </div>
  );
}
