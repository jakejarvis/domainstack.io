import { useMutation, useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useReducer, useState } from "react";
import { Share, View } from "react-native";

import { Button } from "@/components/button";
import { ShareInstructionsSheet } from "@/components/domain/add-domain/share-instructions-sheet";
import { StepConfirmation } from "@/components/domain/add-domain/step-confirmation";
import { StepIndicator } from "@/components/domain/add-domain/step-indicator";
import { VerificationFailed } from "@/components/domain/add-domain/verification-failed";
import { EmptyState } from "@/components/empty-state";
import { GroupedSection } from "@/components/form/group";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { type AddDomainFlowState, reduceAddDomainFlow } from "@/lib/domain-lifecycle";
import { assertOnline } from "@/lib/network";
import type { VerificationMethod } from "@domainstack/constants";
import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";
import { buildVerificationInstructions } from "@domainstack/utils/verification";

const initialState: AddDomainFlowState = { domain: "", status: "idle" };

const METHOD_OPTIONS: Array<{ label: string; value: VerificationMethod }> = [
  { label: "DNS", value: "dns_txt" },
  { label: "HTML", value: "html_file" },
  { label: "Meta", value: "meta_tag" },
];

function currentStep(status: AddDomainFlowState["status"]): 1 | 2 | 3 {
  if (status === "verified") return 3;
  if (status === "instructions" || status === "verifying" || status === "failed") return 2;
  return 1;
}

function loadingStep(status: AddDomainFlowState["status"]): 1 | 2 | undefined {
  if (status === "submitting") return 1;
  if (status === "verifying") return 2;
  return undefined;
}

function InstructionValue({ label, value }: { label: string; value: string | number }) {
  const stringValue = String(value);

  async function handleCopy() {
    await Clipboard.setStringAsync(stringValue);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View className="gap-2">
      <MutedText className="font-semibold">{label}</MutedText>
      <View className="border-line bg-canvas-2 gap-2 rounded-xl border p-3">
        <Text className="font-mono text-sm" selectable>
          {stringValue}
        </Text>
        <View className="flex-row gap-2">
          <Button className="flex-1" onPress={() => void handleCopy()} variant="secondary">
            <Text>Copy</Text>
          </Button>
          <Button
            className="flex-1"
            onPress={() => void Share.share({ message: stringValue })}
            variant="secondary"
          >
            <Text>Share</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}

export default function AddDomainScreen() {
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <Screen>
        <SkeletonRows count={3} />
      </Screen>
    );
  }

  if (!session.data?.user) {
    return (
      <Screen>
        <View className="gap-2">
          <Text className="text-4xl font-semibold">Add domain</Text>
          <MutedText>Sign in to verify ownership and add domains to your portfolio.</MutedText>
        </View>
        <EmptyState
          actionLabel="Sign in"
          body="Domain ownership verification is attached to your account."
          onAction={() => router.push("/sign-in")}
          title="Account required"
        />
      </Screen>
    );
  }

  return <AddDomainFlow />;
}

function AddDomainFlow() {
  const params = useLocalSearchParams<{ trackedDomainId?: string }>();
  const resumeTrackedDomainId = Array.isArray(params.trackedDomainId)
    ? params.trackedDomainId[0]
    : params.trackedDomainId;
  const [flow, dispatch] = useReducer(reduceAddDomainFlow, initialState);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const trpc = useTRPC();

  const addDomain = useMutation(trpc.tracking.addDomain.mutationOptions());
  const verifyDomain = useMutation(trpc.tracking.verifyDomain.mutationOptions());
  const verificationData = useQuery(
    trpc.tracking.getVerificationData.queryOptions(
      { trackedDomainId: resumeTrackedDomainId ?? "" },
      { enabled: Boolean(resumeTrackedDomainId) },
    ),
  );

  useEffect(() => {
    if (!verificationData.data || !resumeTrackedDomainId) return;
    dispatch({ domain: verificationData.data.domain, type: "edit" });
    dispatch({ type: "submit" });
    dispatch({
      method: verificationData.data.verificationMethod ?? "dns_txt",
      token: verificationData.data.verificationToken,
      trackedDomainId: resumeTrackedDomainId,
      type: "instructions",
    });
  }, [resumeTrackedDomainId, verificationData.data]);

  const normalized = normalizeDomainInput(flow.domain);
  const domainError =
    hasAttemptedSubmit && flow.domain.trim().length > 0 && !isValidDomain(normalized)
      ? "Enter a hostname like example.com."
      : undefined;

  async function submit() {
    setHasAttemptedSubmit(true);
    const trimmed = normalizeDomainInput(flow.domain);
    if (!isValidDomain(trimmed)) return;
    dispatch({ domain: trimmed, type: "edit" });
    dispatch({ type: "submit" });
    try {
      await assertOnline();
      const result = await addDomain.mutateAsync({ domain: trimmed });
      dispatch({
        method: "dns_txt",
        token: result.verificationToken,
        trackedDomainId: result.id,
        type: "instructions",
      });
    } catch (error) {
      dispatch({
        message: error instanceof Error ? error.message : "Domain could not be added",
        type: "fail",
      });
    }
  }

  async function verify(method: VerificationMethod) {
    if (!("trackedDomainId" in flow) || !flow.trackedDomainId) return;
    const trackedDomainId = flow.trackedDomainId;
    dispatch({ method, type: "setMethod" });
    dispatch({ type: "verify" });
    try {
      await assertOnline();
      const result = await verifyDomain.mutateAsync({
        method,
        trackedDomainId,
      });
      if (result.verified) {
        dispatch({ type: "verified" });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        dispatch({
          message:
            "Verification was not found yet. Try again after DNS or hosting changes propagate.",
          type: "fail",
        });
      }
    } catch (error) {
      dispatch({
        message: error instanceof Error ? error.message : "Verification failed",
        type: "fail",
      });
    }
  }

  function handleDone() {
    if (flow.status !== "verified") return;
    router.replace({
      params: { domain: flow.domain },
      pathname: "/(tabs)/domains/[domain]",
    });
  }

  const step = currentStep(flow.status);
  const activeLoading = loadingStep(flow.status);

  const activeMethod: VerificationMethod =
    flow.status === "instructions" || flow.status === "verifying"
      ? flow.method
      : flow.status === "failed" && flow.method
        ? flow.method
        : "dns_txt";

  const instructionsBundle = useMemo(() => {
    if (flow.status !== "instructions" && flow.status !== "verifying" && flow.status !== "failed") {
      return null;
    }
    const token = "token" in flow ? flow.token : undefined;
    if (typeof token !== "string") return null;
    return buildVerificationInstructions(flow.domain, token);
  }, [flow]);

  const trackedDomainId =
    flow.status === "instructions" || flow.status === "verifying" || flow.status === "failed"
      ? flow.trackedDomainId
      : undefined;
  const verificationToken =
    flow.status === "instructions" || flow.status === "verifying" || flow.status === "failed"
      ? flow.token
      : undefined;

  return (
    <Screen>
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-3xl font-semibold">
            {flow.status === "verified" ? "All set!" : "Add domain"}
          </Text>
          <MutedText>Verify ownership once, then Domainstack can track changes natively.</MutedText>
        </View>

        <StepIndicator current={step} loadingStep={activeLoading} />

        {step === 1 ? (
          <GroupedSection>
            <View className="gap-3 px-4 pt-3 pb-4">
              <TextField
                bare
                error={domainError}
                label="Domain"
                onChangeText={(domain) => dispatch({ domain, type: "edit" })}
                onSubmitEditing={() => void submit()}
                placeholder="example.com"
                returnKeyType="go"
                value={flow.domain}
              />
            </View>
            <View className="border-line border-t p-3">
              <Button
                disabled={flow.domain.trim().length === 0}
                loading={addDomain.isPending || flow.status === "submitting"}
                onPress={() => void submit()}
              >
                <Text>Continue</Text>
              </Button>
            </View>
          </GroupedSection>
        ) : null}

        {resumeTrackedDomainId && verificationData.isPending ? <SkeletonRows count={3} /> : null}

        {step === 2 && instructionsBundle ? (
          <View className="gap-4">
            <SegmentedControl<VerificationMethod>
              onChange={(method) => dispatch({ method, type: "setMethod" })}
              options={METHOD_OPTIONS}
              value={activeMethod}
            />

            {flow.status === "failed" && trackedDomainId && verificationToken ? (
              <VerificationFailed
                loading={verifyDomain.isPending}
                message={flow.message}
                method={activeMethod}
                onCheckAgain={() => void verify(activeMethod)}
                onReturnLater={() => router.back()}
              />
            ) : (
              <GlassCard>
                {activeMethod === "dns_txt" ? (
                  <>
                    <Text className="text-xl font-semibold">DNS TXT record</Text>
                    <MutedText>{instructionsBundle.dns_txt.description}</MutedText>
                    <InstructionValue
                      label="Hostname"
                      value={instructionsBundle.dns_txt.hostname}
                    />
                    <InstructionValue label="Type" value={instructionsBundle.dns_txt.recordType} />
                    <InstructionValue label="Value" value={instructionsBundle.dns_txt.value} />
                    <InstructionValue
                      label="TTL"
                      value={instructionsBundle.dns_txt.suggestedTTLLabel}
                    />
                  </>
                ) : null}

                {activeMethod === "html_file" ? (
                  <>
                    <Text className="text-xl font-semibold">HTML file</Text>
                    <MutedText>{instructionsBundle.html_file.description}</MutedText>
                    <InstructionValue label="Path" value={instructionsBundle.html_file.fullPath} />
                    <InstructionValue
                      label="Contents"
                      value={instructionsBundle.html_file.fileContent}
                    />
                  </>
                ) : null}

                {activeMethod === "meta_tag" ? (
                  <>
                    <Text className="text-xl font-semibold">Meta tag</Text>
                    <MutedText>{instructionsBundle.meta_tag.description}</MutedText>
                    <InstructionValue label="Tag" value={instructionsBundle.meta_tag.metaTag} />
                  </>
                ) : null}
              </GlassCard>
            )}

            {flow.status !== "failed" ? (
              <View className="flex-row gap-2">
                <Button className="flex-1" onPress={() => setShareOpen(true)} variant="secondary">
                  <Text>Share…</Text>
                </Button>
                <Button
                  className="flex-1"
                  loading={verifyDomain.isPending || flow.status === "verifying"}
                  onPress={() => void verify(activeMethod)}
                >
                  <Text>Check now</Text>
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View className="gap-4">
            <GlassCard>
              <StepConfirmation domain={flow.domain} />
            </GlassCard>
            <Button onPress={handleDone}>
              <Text>Open domain</Text>
            </Button>
          </View>
        ) : null}
      </View>

      {trackedDomainId && verificationToken ? (
        <ShareInstructionsSheet
          domain={flow.domain}
          onOpenChange={setShareOpen}
          open={shareOpen}
          trackedDomainId={trackedDomainId}
          verificationToken={verificationToken}
        />
      ) : null}
    </Screen>
  );
}
