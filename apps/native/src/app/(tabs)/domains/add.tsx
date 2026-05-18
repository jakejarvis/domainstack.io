import { useMutation, useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Share, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ShareInstructionsSheet } from "@/components/domain/add-domain/share-instructions-sheet";
import { StepConfirmation } from "@/components/domain/add-domain/step-confirmation";
import { StepIndicator } from "@/components/domain/add-domain/step-indicator";
import { VerificationFailed } from "@/components/domain/add-domain/verification-failed";
import { GroupedSection } from "@/components/form/group";
import { QueryErrorState } from "@/components/query-error-state";
import { RequireAuth } from "@/components/require-auth";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SkeletonRows } from "@/components/skeleton";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { usePushSoftPrompt } from "@/hooks/use-push-soft-prompt";
import { useTRPC } from "@/lib/api";
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
      <Text className="text-sm font-semibold text-muted-foreground">{label}</Text>
      <View className="gap-2 rounded-xl border border-border bg-muted p-3">
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
  return (
    <RequireAuth
      body="Domain ownership verification is attached to your account. Sign in to add domains to your portfolio."
      loading={<SkeletonRows count={3} />}
      title="Adding domains is locked"
    >
      <AddDomainFlow />
    </RequireAuth>
  );
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
  const navigation = useNavigation();
  const triggerPushPrompt = usePushSoftPrompt();

  useEffect(() => {
    navigation.setOptions({ title: flow.status === "verified" ? "All set" : "Add domain" });
  }, [navigation, flow.status]);

  const addDomain = useMutation(trpc.tracking.addDomain.mutationOptions());
  const verifyDomain = useMutation(trpc.tracking.verifyDomain.mutationOptions());
  const verificationData = useQuery(
    trpc.tracking.getVerificationData.queryOptions(
      { trackedDomainId: resumeTrackedDomainId ?? "" },
      { enabled: Boolean(resumeTrackedDomainId) },
    ),
  );

  // Resume-from-verification must run exactly once per trackedDomainId. Without
  // this guard a refetch of `verificationData` (focus/reconnect) re-dispatches
  // edit→submit→instructions and clobbers a user who has progressed to step 2/3.
  const resumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!verificationData.data || !resumeTrackedDomainId) return;
    if (resumedRef.current === resumeTrackedDomainId) return;
    resumedRef.current = resumeTrackedDomainId;
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
      assertOnline();
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
      assertOnline();
      const result = await verifyDomain.mutateAsync({
        method,
        trackedDomainId,
      });
      if (result.verified) {
        dispatch({ type: "verified" });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void triggerPushPrompt("firstDomain");
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
        <StepIndicator current={step} loadingStep={activeLoading} />

        {step === 1 && !resumeTrackedDomainId ? (
          <GroupedSection>
            <View className="gap-3 px-4 pt-3 pb-4">
              <TextField
                autoComplete="off"
                bare
                error={domainError}
                label="Domain"
                onChangeText={(domain) => dispatch({ domain, type: "edit" })}
                onSubmitEditing={() => void submit()}
                placeholder="example.com"
                returnKeyType="go"
                textContentType="URL"
                value={flow.domain}
              />
            </View>
            <View className="border-t border-border p-3">
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

        {resumeTrackedDomainId && step === 1 ? (
          verificationData.error ? (
            <QueryErrorState
              onRetry={() => void verificationData.refetch()}
              title="Couldn’t load verification"
            />
          ) : (
            <SkeletonRows count={3} />
          )
        ) : null}

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
              <Card>
                {activeMethod === "dns_txt" ? (
                  <>
                    <Text className="text-xl font-semibold">DNS TXT record</Text>
                    <Text className="text-sm text-muted-foreground">
                      {instructionsBundle.dns_txt.description}
                    </Text>
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
                    <Text className="text-sm text-muted-foreground">
                      {instructionsBundle.html_file.description}
                    </Text>
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
                    <Text className="text-sm text-muted-foreground">
                      {instructionsBundle.meta_tag.description}
                    </Text>
                    <InstructionValue label="Tag" value={instructionsBundle.meta_tag.metaTag} />
                  </>
                ) : null}
              </Card>
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
            <Card>
              <StepConfirmation domain={flow.domain} />
            </Card>
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
