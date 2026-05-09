import { TextInput, View } from "react-native";

import { cn } from "@/lib/cn";

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
  return (
    <View className="gap-2">
      <MutedText className="font-semibold">{label}</MutedText>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        className={cn(
          "border-line bg-glass text-text-primary min-h-12 rounded-xl border px-4 text-base",
        )}
        inputMode="url"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6f7f75"
        spellCheck={false}
        value={value}
      />
    </View>
  );
}
