import { RefreshControl as NativeRefreshControl, type RefreshControlProps } from "react-native";
import { useCSSVariable } from "uniwind";

export function RefreshControl(props: RefreshControlProps) {
  const accent = useCSSVariable("--color-brand") as string;
  const surface = useCSSVariable("--color-glass") as string;

  return (
    <NativeRefreshControl
      colors={[accent]}
      progressBackgroundColor={surface}
      tintColor={accent}
      {...props}
    />
  );
}
