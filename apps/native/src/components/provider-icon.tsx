import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import type { OAuthProviderId } from "@domainstack/auth/providers";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const ICON_MAP: Record<OAuthProviderId, IconName> = {
  apple: "apple",
  github: "github",
  gitlab: "gitlab",
  google: "google",
  // Vercel doesn't ship in MCI; their mark is a triangle.
  vercel: "triangle",
};

export function ProviderIcon({
  color,
  provider,
  size = 20,
}: {
  color?: string;
  provider: OAuthProviderId;
  size?: number;
}) {
  return <MaterialCommunityIcons color={color} name={ICON_MAP[provider]} size={size} />;
}
