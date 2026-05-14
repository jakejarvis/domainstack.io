import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ColorValue } from "react-native";

export type SymbolName = SymbolViewProps["name"];

export function Symbol({
  color,
  name,
  size = 22,
  style,
  weight = "regular",
}: {
  color?: ColorValue;
  name: SymbolName;
  size?: number;
  style?: SymbolViewProps["style"];
  weight?: SymbolViewProps["weight"];
}) {
  return (
    <SymbolView
      name={name}
      resizeMode="scaleAspectFit"
      size={size}
      style={style}
      tintColor={color}
      weight={weight}
    />
  );
}
