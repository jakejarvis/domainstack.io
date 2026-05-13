import { TextInput, View } from "react-native";

import { useCSSVariable } from "@/tw";

import { MutedText } from "./text";

export function TextField({
  autoCapitalize = "none",
  label,
  onChangeText,
  placeholder,
  value,
}: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const placeholderTextColor = useCSSVariable("--color-text-secondary");

  return (
    <View className="gap-2">
      <MutedText className="font-semibold">{label}</MutedText>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        className="border-line bg-glass text-text-primary min-h-12 rounded-xl border px-4 text-base"
        inputMode="url"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        spellCheck={false}
        value={value}
      />
    </View>
  );
}
