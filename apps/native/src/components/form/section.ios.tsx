import {
  Button,
  Form as IOSForm,
  Host,
  LabeledContent,
  Section as IOSSection,
  Text,
  Toggle,
} from "@expo/ui/swift-ui";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export function Form({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Host style={[{ flex: 1 }, style]} useViewportSizeMeasurement>
      <IOSForm>{children}</IOSForm>
    </Host>
  );
}

export function Section({
  children,
  footer,
  title,
}: {
  children: ReactNode;
  footer?: string;
  title?: string;
}) {
  return (
    <IOSSection footer={footer ? <Text>{footer}</Text> : undefined} title={title}>
      {children}
    </IOSSection>
  );
}

function ToggleRow({
  label,
  onChange,
  systemImage,
  value,
}: {
  label: string;
  onChange: (value: boolean) => void;
  systemImage?: SFSymbol;
  value: boolean;
}) {
  return <Toggle isOn={value} label={label} onIsOnChange={onChange} systemImage={systemImage} />;
}

function NavigationRow({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  systemImage?: SFSymbol;
  value?: string;
}) {
  return (
    <Button onPress={onPress}>
      <LabeledContent label={label}>{value ? <Text>{value}</Text> : null}</LabeledContent>
    </Button>
  );
}

function ButtonRow({
  destructive = false,
  label,
  onPress,
  systemImage,
}: {
  destructive?: boolean;
  label: string;
  onPress: () => void;
  systemImage?: SFSymbol;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      role={destructive ? "destructive" : "default"}
      systemImage={systemImage}
    />
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <LabeledContent label={label}>
      <Text>{value}</Text>
    </LabeledContent>
  );
}

export const Row = {
  Button: ButtonRow,
  Navigation: NavigationRow,
  Toggle: ToggleRow,
  Value: ValueRow,
};
