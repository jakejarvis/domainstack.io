import { useMutation, useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useReducer } from "react";
import { Alert, Share, View } from "react-native";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { type AddDomainFlowState, reduceAddDomainFlow } from "@/lib/domain-lifecycle";
import { assertOnline } from "@/lib/network";
import type { VerificationMethod } from "@domainstack/constants";
import { buildVerificationInstructions } from "@domainstack/utils/verification";

const initialState: AddDomainFlowState = { domain: "", status: "idle" };

function InstructionValue({ label, value }: { label: string; value: string | number }) {
  const stringValue = String(value);
  return (
    <View className="gap-2">
      <MutedText className="font-semibold">{label}</MutedText>
      <View className="border-line bg-canvas-2 gap-2 rounded-xl border p-3">
        <Text className="font-mono text-sm" selectable>
          {stringValue}
        </Text>
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            onPress={() => void Clipboard.setStringAsync(stringValue)}
            variant="secondary"
          >
            Copy
          </Button>
          <Button
            className="flex-1"
            onPress={() => void Share.share({ message: stringValue })}
            variant="secondary"
          >
            Share
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
      token: verificationData.data.verificationToken,
      trackedDomainId: resumeTrackedDomainId,
      type: "instructions",
    });
  }, [resumeTrackedDomainId, verificationData.data]);

  async function submit() {
    dispatch({ type: "submit" });
    try {
      await assertOnline();
      const result = await addDomain.mutateAsync({ domain: flow.domain });
      dispatch({
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

  async function verify(method?: VerificationMethod) {
    if (!("trackedDomainId" in flow) || !flow.trackedDomainId) return;
    const trackedDomainId = flow.trackedDomainId;
    dispatch({ type: "verify" });
    try {
      await assertOnline();
      const result = await verifyDomain.mutateAsync({
        method,
        trackedDomainId,
      });
      if (result.verified) {
        dispatch({ type: "verified" });
        Alert.alert("Domain verified", `${flow.domain} is now tracked.`, [
          {
            onPress: () => router.replace(`/(tabs)/domains/${trackedDomainId}`),
            text: "Open domain",
          },
        ]);
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

  const canSubmit = flow.status === "editing" && flow.domain.trim().length > 0;
  const instructionToken = "token" in flow ? flow.token : undefined;
  const instructions =
    typeof instructionToken === "string"
      ? buildVerificationInstructions(flow.domain, instructionToken)
      : null;

  return (
    <Screen>
      <View className="gap-2">
        <Text className="text-4xl font-semibold">Add domain</Text>
        <MutedText>Verify ownership once, then Domainstack can track changes natively.</MutedText>
      </View>

      {!resumeTrackedDomainId && (
        <GlassCard>
          <TextField
            label="Domain"
            onChangeText={(domain) => dispatch({ domain, type: "edit" })}
            placeholder="example.com"
            value={flow.domain}
          />
          <Button disabled={!canSubmit} loading={addDomain.isPending} onPress={() => void submit()}>
            Continue
          </Button>
        </GlassCard>
      )}

      {resumeTrackedDomainId && verificationData.isPending && <SkeletonRows count={2} />}

      {flow.status === "failed" && (
        <GlassCard>
          <Text className="text-lg font-semibold">Needs attention</Text>
          <MutedText>{flow.message}</MutedText>
        </GlassCard>
      )}

      {instructions && (
        <View className="gap-4">
          <GlassCard>
            <Text className="text-xl font-semibold">DNS TXT</Text>
            <MutedText>{instructions.dns_txt.description}</MutedText>
            <InstructionValue label="Hostname" value={instructions.dns_txt.hostname} />
            <InstructionValue label="Type" value={instructions.dns_txt.recordType} />
            <InstructionValue label="Value" value={instructions.dns_txt.value} />
            <InstructionValue label="TTL" value={instructions.dns_txt.suggestedTTLLabel} />
            <Button loading={verifyDomain.isPending} onPress={() => void verify("dns_txt")}>
              Verify DNS
            </Button>
          </GlassCard>

          <GlassCard>
            <Text className="text-xl font-semibold">HTML file</Text>
            <MutedText>{instructions.html_file.description}</MutedText>
            <InstructionValue label="Path" value={instructions.html_file.fullPath} />
            <InstructionValue label="Contents" value={instructions.html_file.fileContent} />
            <Button
              loading={verifyDomain.isPending}
              onPress={() => void verify("html_file")}
              variant="secondary"
            >
              Verify file
            </Button>
          </GlassCard>

          <GlassCard>
            <Text className="text-xl font-semibold">Meta tag</Text>
            <MutedText>{instructions.meta_tag.description}</MutedText>
            <InstructionValue label="Tag" value={instructions.meta_tag.metaTag} />
            <Button
              loading={verifyDomain.isPending}
              onPress={() => void verify("meta_tag")}
              variant="secondary"
            >
              Verify meta tag
            </Button>
          </GlassCard>
        </View>
      )}
    </Screen>
  );
}
