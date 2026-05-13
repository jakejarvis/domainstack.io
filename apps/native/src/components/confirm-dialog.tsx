import { useEffect, useRef } from "react";
import { View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "./bottom-sheet";
import { Button } from "./button";
import { Text } from "./text";

type ConfirmVariant = "confirm" | "info";

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  destructive = false,
  loading = false,
  onConfirm,
  onOpenChange,
  open,
  title,
  variant = "confirm",
}: {
  cancelLabel?: string;
  confirmLabel: string;
  description?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm?: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  variant?: ConfirmVariant;
}) {
  const ref = useRef<AppBottomSheetRef>(null);

  useEffect(() => {
    if (open) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [open]);

  function handleConfirm() {
    if (variant === "info") {
      onOpenChange(false);
      return;
    }
    void Promise.resolve(onConfirm?.());
  }

  return (
    <AppBottomSheet
      description={description}
      onDismiss={() => onOpenChange(false)}
      ref={ref}
      snapPoints={["35%"]}
      title={title}
    >
      <View className="gap-2">
        {variant === "confirm" ? (
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              disabled={loading}
              onPress={() => onOpenChange(false)}
              variant="secondary"
            >
              <Text>{cancelLabel}</Text>
            </Button>
            <Button
              className="flex-1"
              loading={loading}
              onPress={handleConfirm}
              variant={destructive ? "danger" : "primary"}
            >
              <Text>{confirmLabel}</Text>
            </Button>
          </View>
        ) : (
          <Button onPress={handleConfirm}>
            <Text>{confirmLabel}</Text>
          </Button>
        )}
      </View>
    </AppBottomSheet>
  );
}
