import type { InputModeOptions, ReturnKeyTypeOptions, TextInputProps } from "react-native";
import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn } from "@/lib/cn";

import { MutedText } from "./text";

export function TextField({
  autoCapitalize = "none",
  autoComplete,
  bare = false,
  editable = true,
  error,
  inputMode = "url",
  label,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  textContentType,
  value,
}: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "off";
  bare?: boolean;
  editable?: boolean;
  error?: string;
  inputMode?: InputModeOptions;
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  returnKeyType?: ReturnKeyTypeOptions;
  textContentType?: TextInputProps["textContentType"];
  value: string;
}) {
  const placeholderTextColor = useCSSVariable("--color-text-secondary") as string;
  const dangerColor = useCSSVariable("--color-danger") as string;

  return (
    <View className="gap-2">
      <MutedText className="font-semibold">{label}</MutedText>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        className={cn(
          "text-text-primary min-h-12 text-base",
          !bare && "border-line bg-glass rounded-xl border px-4",
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
        textContentType={textContentType}
        style={
          bare
            ? undefined
            : { borderCurve: "continuous", borderColor: error ? dangerColor : undefined }
        }
        value={value}
      />
      {error ? <MutedText style={{ color: dangerColor }}>{error}</MutedText> : null}
    </View>
  );
}
