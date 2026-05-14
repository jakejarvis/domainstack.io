import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { MutedText, Text } from "@/components/text";
import type { VerificationMethod } from "@domainstack/constants";

const TROUBLESHOOTING_TIPS: Record<VerificationMethod, { title: string; tips: string[] }> = {
  dns_txt: {
    title: "DNS Record Troubleshooting",
    tips: [
      "DNS changes can take up to 24–48 hours to propagate globally.",
      "Verify the TXT record exists in your DNS provider’s dashboard.",
      "Ensure the hostname matches exactly (including the underscore prefix).",
      "Check that the value is copied correctly without extra spaces.",
      "Some DNS providers require removing the domain suffix from the hostname.",
    ],
  },
  html_file: {
    title: "HTML File Troubleshooting",
    tips: [
      "Ensure the file is accessible at the exact path shown.",
      "The file should contain only the verification token, with no extra content.",
      "Check that your server isn’t redirecting the request (e.g., to HTTPS or www).",
      "Verify there are no permission issues blocking access to the file.",
      "Some hosting providers may cache files — try clearing your CDN cache.",
    ],
  },
  meta_tag: {
    title: "Meta Tag Troubleshooting",
    tips: [
      "Ensure the meta tag is placed inside the <head> section of your homepage.",
      "The page must be publicly accessible (not behind authentication).",
      "Check that there are no typos in the meta tag name or content.",
      "If using a framework, ensure the meta tag renders on the server (SSR).",
      "Clear any page caches and verify the tag appears in the page source.",
    ],
  },
};

export function VerificationFailed({
  loading,
  method,
  message,
  onCheckAgain,
  onReturnLater,
}: {
  loading?: boolean;
  method: VerificationMethod;
  message?: string;
  onCheckAgain: () => void;
  onReturnLater: () => void;
}) {
  const dangerColor = useCSSVariable("--color-danger") as string;
  const mutedColor = useCSSVariable("--color-text-secondary") as string;
  const { title, tips } = TROUBLESHOOTING_TIPS[method];

  return (
    <View className="gap-4">
      <GlassCard>
        <View className="flex-row items-start gap-3">
          <MaterialIcons color={dangerColor} name="error-outline" size={20} />
          <View className="flex-1 gap-1">
            <Text className="text-base font-semibold">Verification failed</Text>
            <MutedText>
              {message ??
                "We couldn’t verify your domain ownership yet. Check your setup and try again."}
            </MutedText>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <Text className="text-sm font-medium">{title}</Text>
        <View className="gap-2">
          {tips.map((tip) => (
            <View className="flex-row gap-2" key={tip}>
              <MaterialIcons
                color={mutedColor}
                name="fiber-manual-record"
                size={6}
                style={{ marginTop: 8 }}
              />
              <MutedText className="flex-1">{tip}</MutedText>
            </View>
          ))}
        </View>
      </GlassCard>

      <View className="flex-row gap-2">
        <Button className="flex-1" loading={loading} onPress={onCheckAgain}>
          <Text>Check again</Text>
        </Button>
        <Button className="flex-1" onPress={onReturnLater} variant="secondary">
          <Text>Return later</Text>
        </Button>
      </View>

      <MutedText className="text-center text-xs">
        Don’t worry — we’ll automatically check your domain daily and verify once the changes
        propagate.
      </MutedText>
    </View>
  );
}
