import { ActionSheetIOS, Alert, Platform } from "react-native";

export function confirm({
  cancelLabel = "Cancel",
  confirmLabel,
  destructive = false,
  message,
  title,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  message?: string;
  title: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { onPress: () => resolve(false), style: "cancel", text: cancelLabel },
        {
          onPress: () => resolve(true),
          style: destructive ? "destructive" : "default",
          text: confirmLabel,
        },
      ],
      { onDismiss: () => resolve(false) },
    );
  });
}

export type ActionSheetOption = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

export function showActionSheetIOS({
  cancelLabel = "Cancel",
  message,
  options,
  title,
}: {
  cancelLabel?: string;
  message?: string;
  options: ActionSheetOption[];
  title?: string;
}): boolean {
  if (Platform.OS !== "ios") return false;
  const labels = options.map((option) => option.label).concat(cancelLabel);
  const destructiveIndexes = options.flatMap((option, index) =>
    option.destructive ? [index] : [],
  );
  ActionSheetIOS.showActionSheetWithOptions(
    {
      cancelButtonIndex: labels.length - 1,
      destructiveButtonIndex: destructiveIndexes.length > 0 ? destructiveIndexes : undefined,
      message,
      options: labels,
      title,
      userInterfaceStyle: undefined,
    },
    (buttonIndex) => {
      if (buttonIndex < 0 || buttonIndex >= options.length) return;
      options[buttonIndex]?.onPress();
    },
  );
  return true;
}
