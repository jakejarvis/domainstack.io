import type { ReturnKeyTypeOptions } from "react-native";
import { TextInput, View } from "react-native";

import { useCSSVariable } from "@/tw";

import { MutedText } from "./text";

export function TextField({
  autoCapitalize = "none",
  label,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  value,
}: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  returnKeyType?: ReturnKeyTypeOptions;
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
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        returnKeyType={returnKeyType}
        spellCheck={false}
        value={value}
      />
    </View>
  );
}
