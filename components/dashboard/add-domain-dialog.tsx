"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type ResumeDomainData = {
  id: string;
  domainName: string;
  verificationToken: string;
};

type AddDomainDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** If provided, skips step 1 and goes directly to verification */
  resumeDomain?: ResumeDomainData | null;
};

type VerificationMethod = "dns_txt" | "html_file" | "meta_tag";

type InstructionDetails = {
  title: string;
  description: string;
  code: string;
  copyValue: string;
};

type Instructions = {
  dns_txt: InstructionDetails;
  html_file: InstructionDetails;
  meta_tag: InstructionDetails;
};

const STEP_TITLES = ["Enter domain", "Verify ownership", "Complete"];

export function AddDomainDialog({
  open,
  onOpenChange,
  onSuccess,
  resumeDomain,
}: AddDomainDialogProps) {
  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("dns_txt");
  const [trackedDomainId, setTrackedDomainId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const trpc = useTRPC();
  const addDomainMutation = useMutation(
    trpc.tracking.addDomain.mutationOptions(),
  );
  const verifyDomainMutation = useMutation(
    trpc.tracking.verifyDomain.mutationOptions(),
  );

  // Fetch instructions when resuming verification
  const instructionsQuery = useQuery({
    ...trpc.tracking.getVerificationInstructions.queryOptions({
      trackedDomainId: resumeDomain?.id ?? "",
    }),
    enabled: !!resumeDomain && open,
  });

  // When resumeDomain changes and dialog opens, set up resume state
  useEffect(() => {
    if (resumeDomain && open) {
      setDomain(resumeDomain.domainName);
      setTrackedDomainId(resumeDomain.id);
      setStep(2);
    }
  }, [resumeDomain, open]);

  // When instructions are fetched for resume mode, set them
  useEffect(() => {
    if (instructionsQuery.data && resumeDomain) {
      setInstructions(instructionsQuery.data);
    }
  }, [instructionsQuery.data, resumeDomain]);

  const resetDialog = useCallback(() => {
    setStep(1);
    setDomain("");
    setDomainError("");
    setMethod("dns_txt");
    setTrackedDomainId(null);
    setInstructions(null);
    setIsVerifying(false);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialog();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetDialog],
  );

  const handleAddDomain = async () => {
    setDomainError("");

    try {
      const result = await addDomainMutation.mutateAsync({ domain });
      setTrackedDomainId(result.id);
      setInstructions(result.instructions);
      setStep(2);

      // Let user know if they're resuming a previous verification attempt
      if (result.resumed) {
        toast.info("Resuming verification", {
          description:
            "You previously started tracking this domain. Your verification token is unchanged.",
        });
      }
    } catch (err) {
      if (err instanceof Error) {
        setDomainError(err.message);
      } else {
        setDomainError("Failed to add domain");
      }
    }
  };

  const handleVerify = async () => {
    if (!trackedDomainId) return;

    setIsVerifying(true);

    try {
      const result = await verifyDomainMutation.mutateAsync({
        trackedDomainId,
        method,
      });

      if (result.verified) {
        setStep(3);
        toast.success("Domain verified successfully!");
      } else {
        toast.error(
          result.error || "Verification failed. Please check your setup.",
        );
      }
    } catch (_err) {
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDone = () => {
    onSuccess();
    handleOpenChange(false);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return domain.trim().length > 0 && !addDomainMutation.isPending;
      case 2:
        return !isVerifying;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    switch (step) {
      case 1:
        await handleAddDomain();
        break;
      case 2:
        await handleVerify();
        break;
      case 3:
        handleDone();
        break;
    }
  };

  const isResuming = !!resumeDomain;
  const isLoadingInstructions = isResuming && instructionsQuery.isLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isResuming ? "Complete Verification" : "Add Domain"}
          </DialogTitle>
          <DialogDescription>
            {isResuming
              ? `Verify ownership of ${domain}`
              : `Step ${step} of 3 — ${STEP_TITLES[step - 1]}`}
          </DialogDescription>
          {/* Step indicator dots - only show for new domain flow */}
          {!isResuming && (
            <div className="flex gap-1.5 pt-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    s === step ? "w-6 bg-primary" : "w-1.5 bg-muted",
                  )}
                />
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && !isResuming && (
                <StepEnterDomain
                  domain={domain}
                  setDomain={setDomain}
                  error={domainError}
                  isLoading={addDomainMutation.isPending}
                />
              )}
              {step === 2 && isLoadingInstructions && (
                <div className="flex h-[200px] items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              )}
              {step === 2 && instructions && !isLoadingInstructions && (
                <StepVerifyOwnership
                  method={method}
                  setMethod={setMethod}
                  instructions={instructions}
                  isVerifying={isVerifying}
                />
              )}
              {step === 3 && <StepConfirmation domain={domain} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <DialogFooter>
          {step === 2 && !isResuming && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isLoadingInstructions}
          >
            {(addDomainMutation.isPending || isVerifying) && (
              <Spinner className="size-4" />
            )}
            {step === 2
              ? isVerifying
                ? "Verifying..."
                : "Verify & Continue"
              : step === 3
                ? "Done"
                : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepEnterDomain({
  domain,
  setDomain,
  error,
  isLoading,
}: {
  domain: string;
  setDomain: (v: string) => void;
  error: string;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="domain">Domain name</Label>
        <Input
          id="domain"
          placeholder="example.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          disabled={isLoading}
          aria-invalid={!!error}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
      <p className="text-muted-foreground text-sm">
        Enter the domain you want to track. You&apos;ll need to verify ownership
        in the next step.
      </p>
    </div>
  );
}

function StepVerifyOwnership({
  method,
  setMethod,
  instructions,
  isVerifying,
}: {
  method: VerificationMethod;
  setMethod: (m: VerificationMethod) => void;
  instructions: Instructions;
  isVerifying: boolean;
}) {
  return (
    <div className="space-y-4">
      <Tabs
        value={method}
        onValueChange={(v) => setMethod(v as VerificationMethod)}
      >
        <TabsList className="grid w-full grid-cols-3">
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

        <TabsContent value="dns_txt" className="mt-4 space-y-3">
          <VerificationInstructions instructions={instructions.dns_txt} />
        </TabsContent>

        <TabsContent value="html_file" className="mt-4 space-y-3">
          <VerificationInstructions instructions={instructions.html_file} />
        </TabsContent>

        <TabsContent value="meta_tag" className="mt-4 space-y-3">
          <VerificationInstructions instructions={instructions.meta_tag} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VerificationInstructions({
  instructions,
}: {
  instructions: InstructionDetails;
}) {
  return (
    <>
      <Alert>
        <Info className="size-4" />
        <AlertTitle>{instructions.title}</AlertTitle>
        <AlertDescription>{instructions.description}</AlertDescription>
      </Alert>

      <div className="relative rounded-lg bg-muted p-4 font-mono text-sm">
        <pre className="whitespace-pre-wrap break-all pr-10">
          {instructions.code}
        </pre>
        <div className="absolute top-2 right-2">
          <CopyButton value={instructions.copyValue} />
        </div>
      </div>
    </>
  );
}

function StepConfirmation({ domain }: { domain: string }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
        <CheckCircle className="size-6 text-success-foreground" />
      </div>
      <div>
        <h3 className="font-semibold">Domain verified!</h3>
        <p className="text-muted-foreground text-sm">
          <span className="font-medium">{domain}</span> has been added to your
          dashboard. You&apos;ll receive notifications when it&apos;s about to
          expire.
        </p>
      </div>
    </div>
  );
}
