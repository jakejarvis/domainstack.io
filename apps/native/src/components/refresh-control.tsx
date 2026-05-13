import { RefreshControl as NativeRefreshControl, type RefreshControlProps } from "react-native";

import { useCSSVariable } from "@/tw";

export function RefreshControl(props: RefreshControlProps) {
  const accent = useCSSVariable("--color-brand");
  const surface = useCSSVariable("--color-glass");

  return (
    <NativeRefreshControl
      colors={[accent]}
      progressBackgroundColor={surface}
      tintColor={accent}
      {...props}
    />
  );
}
