import type { InputModeOptions, ReturnKeyTypeOptions } from "react-native";
import { TextInput, View } from "react-native";

import { cn } from "@/lib/cn";
import { useCSSVariable } from "@/tw";

import { MutedText } from "./text";

export function TextField({
  autoCapitalize = "none",
  autoComplete,
  editable = true,
  error,
  inputMode = "url",
  label,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  value,
}: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "off";
  editable?: boolean;
  error?: string;
  inputMode?: InputModeOptions;
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  returnKeyType?: ReturnKeyTypeOptions;
  value: string;
}) {
  const placeholderTextColor = useCSSVariable("--color-text-secondary");
  const dangerColor = useCSSVariable("--color-danger");

  return (
    <View className="gap-2">
      <MutedText className="font-semibold">{label}</MutedText>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        className={cn(
          "border-line bg-glass text-text-primary min-h-12 rounded-xl border px-4 text-base",
          !editable && "opacity-60",
        )}
        editable={editable}
        inputMode={inputMode}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        returnKeyType={returnKeyType}
        spellCheck={false}
        style={{ borderCurve: "continuous", borderColor: error ? dangerColor : undefined }}
        value={value}
      />
      {error ? <MutedText style={{ color: dangerColor }}>{error}</MutedText> : null}
    </View>
  );
}
