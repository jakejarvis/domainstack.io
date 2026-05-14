import { ScrollView, View } from "react-native";

import { ProviderLogo } from "@/components/provider-logo";
import { MutedText } from "@/components/text";
import type { PortfolioDomain } from "@/lib/portfolio";

type Slot = {
  key: "registrar" | "dns" | "hosting" | "email" | "ca";
  provider: PortfolioDomain["registrar"];
  label: string;
};

export function ProviderChips({ domain }: { domain: PortfolioDomain }) {
  const slots: Slot[] = [
    { key: "registrar", provider: domain.registrar, label: "Registrar" },
    { key: "dns", provider: domain.dns, label: "DNS" },
    { key: "hosting", provider: domain.hosting, label: "Host" },
    { key: "email", provider: domain.email, label: "Email" },
    { key: "ca", provider: domain.ca, label: "CA" },
  ];
  const visible = slots.filter((s) => s.provider?.name);
  if (visible.length === 0) return null;

  return (
    <ScrollView
      contentContainerStyle={{ gap: 6 }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {visible.map(({ key, provider, label }) => (
        <View
          accessibilityLabel={`${label}: ${provider?.name ?? ""}`}
          className="border-line bg-control-secondary flex-row items-center gap-1.5 rounded-full border px-2.5 py-1"
          key={key}
        >
          <ProviderLogo providerId={provider?.id} providerName={provider?.name} size={14} />
          <MutedText className="text-xs" numberOfLines={1}>
            {provider?.name}
          </MutedText>
        </View>
      ))}
    </ScrollView>
  );
}
