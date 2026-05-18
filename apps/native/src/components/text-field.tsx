import type { InputModeOptions, ReturnKeyTypeOptions, TextInputProps } from "react-native";
import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn } from "@/lib/cn";

import { Text } from "./text";

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
  const placeholderTextColor = useCSSVariable("--color-muted-foreground") as string;
  const dangerColor = useCSSVariable("--color-destructive") as string;

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-muted-foreground">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        aria-invalid={Boolean(error)}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        className={cn(
          "min-h-12 text-base text-foreground",
          !bare && "bg-glass rounded-xl border border-border px-4",
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
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          role="alert"
          style={{ color: dangerColor }}
          className="text-sm"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
