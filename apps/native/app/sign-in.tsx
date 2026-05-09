import { View } from "react-native";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { MutedText, Text } from "@/components/text";
import { type AuthProvider, signInWithProvider } from "@/lib/auth";

const providers: Array<{ label: string; provider: AuthProvider }> = [
  { label: "Continue with Apple", provider: "apple" },
  { label: "Continue with Google", provider: "google" },
  { label: "Continue with GitHub", provider: "github" },
];

export default function SignInScreen() {
  return (
    <Screen>
      <View className="gap-2">
        <Text className="text-4xl font-semibold">Domainstack</Text>
        <MutedText>Sign in to manage tracked domains, verification, and alerts.</MutedText>
      </View>

      <GlassCard>
        {providers.map((item) => (
          <Button
            key={item.provider}
            onPress={() => {
              void signInWithProvider(item.provider);
            }}
            variant={item.provider === "apple" ? "primary" : "secondary"}
          >
            {item.label}
          </Button>
        ))}
      </GlassCard>
    </Screen>
  );
}
