import { type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Symbol } from "@/components/symbol";
import { Text } from "@/components/text";
import type { VerificationMethod } from "@domainstack/constants";

// Module scope → `msg` (lazy); resolved with `i18n._()` at render.
const TROUBLESHOOTING_TIPS: Record<
  VerificationMethod,
  { title: MessageDescriptor; tips: MessageDescriptor[] }
> = {
  dns_txt: {
    title: msg`DNS Record Troubleshooting`,
    tips: [
      msg`DNS changes can take up to 24–48 hours to propagate globally.`,
      msg`Verify the TXT record exists in your DNS provider’s dashboard.`,
      msg`Ensure the hostname matches exactly (including the underscore prefix).`,
      msg`Check that the value is copied correctly without extra spaces.`,
      msg`Some DNS providers require removing the domain suffix from the hostname.`,
    ],
  },
  html_file: {
    title: msg`HTML File Troubleshooting`,
    tips: [
      msg`Ensure the file is accessible at the exact path shown.`,
      msg`The file should contain only the verification token, with no extra content.`,
      msg`Check that your server isn’t redirecting the request (e.g., to HTTPS or www).`,
      msg`Verify there are no permission issues blocking access to the file.`,
      msg`Some hosting providers may cache files — try clearing your CDN cache.`,
    ],
  },
  meta_tag: {
    title: msg`Meta Tag Troubleshooting`,
    tips: [
      msg`Ensure the meta tag is placed inside the <head> section of your homepage.`,
      msg`The page must be publicly accessible (not behind authentication).`,
      msg`Check that there are no typos in the meta tag name or content.`,
      msg`If using a framework, ensure the meta tag renders on the server (SSR).`,
      msg`Clear any page caches and verify the tag appears in the page source.`,
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
  const { t, i18n } = useLingui();
  const dangerColor = useCSSVariable("--color-destructive") as string;
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const { title, tips } = TROUBLESHOOTING_TIPS[method];
  const resolvedTips = tips.map((tip) => i18n._(tip));

  return (
    <View className="gap-4">
      <Card>
        <View className="flex-row items-start gap-3">
          <Symbol
            color={dangerColor}
            name={{ android: "error_outline", ios: "exclamationmark.circle" }}
            size={20}
          />
          <View className="flex-1 gap-1">
            <Text variant="headline">
              <Trans>Verification failed</Trans>
            </Text>
            <Text className="text-sm text-muted-foreground">
              {message ??
                t`We couldn’t verify your domain ownership yet. Check your setup and try again.`}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text className="text-sm font-medium">{i18n._(title)}</Text>
        <View className="gap-2">
          {resolvedTips.map((tip) => (
            <View className="flex-row gap-2" key={tip}>
              <Symbol
                color={mutedColor}
                name={{ android: "fiber_manual_record", ios: "circle.fill" }}
                size={6}
                style={{ marginTop: 8 }}
              />
              <Text className="flex-1 text-sm text-muted-foreground">{tip}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View className="flex-row gap-2">
        <Button className="flex-1" loading={loading} onPress={onCheckAgain}>
          <Text>
            <Trans>Check again</Trans>
          </Text>
        </Button>
        <Button className="flex-1" onPress={onReturnLater} variant="secondary">
          <Text>
            <Trans>Return later</Trans>
          </Text>
        </Button>
      </View>

      <Text className="text-center text-xs text-muted-foreground">
        <Trans>
          Don’t worry: we’ll automatically check your domain daily and verify once the changes
          propagate.
        </Trans>
      </Text>
    </View>
  );
}
