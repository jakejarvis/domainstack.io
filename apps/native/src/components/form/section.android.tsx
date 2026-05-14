import { Column, Host, ListItem, Switch, Text } from "@expo/ui/jetpack-compose";
import { clickable, paddingAll, verticalScroll } from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export function Form({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Host style={[{ flex: 1 }, style]} useViewportSizeMeasurement>
      <Column modifiers={[verticalScroll(), paddingAll(8)]}>{children}</Column>
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
    <Column modifiers={[paddingAll(4)]}>
      {title ? <Text>{title.toUpperCase()}</Text> : null}
      {children}
      {footer ? <Text>{footer}</Text> : null}
    </Column>
  );
}

function ToggleRow({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <ListItem>
      <ListItem.HeadlineContent>
        <Text>{label}</Text>
      </ListItem.HeadlineContent>
      <ListItem.TrailingContent>
        <Switch onCheckedChange={onChange} value={value} />
      </ListItem.TrailingContent>
    </ListItem>
  );
}

function NavigationRow({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  value?: string;
}) {
  return (
    <ListItem modifiers={[clickable(onPress)]}>
      <ListItem.HeadlineContent>
        <Text>{label}</Text>
      </ListItem.HeadlineContent>
      {value ? (
        <ListItem.TrailingContent>
          <Text>{value}</Text>
        </ListItem.TrailingContent>
      ) : null}
    </ListItem>
  );
}

function ButtonRow({
  label,
  onPress,
}: {
  destructive?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <ListItem modifiers={[clickable(onPress)]}>
      <ListItem.HeadlineContent>
        <Text>{label}</Text>
      </ListItem.HeadlineContent>
    </ListItem>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <ListItem>
      <ListItem.HeadlineContent>
        <Text>{label}</Text>
      </ListItem.HeadlineContent>
      <ListItem.TrailingContent>
        <Text>{value}</Text>
      </ListItem.TrailingContent>
    </ListItem>
  );
}

export const Row = {
  Button: ButtonRow,
  Navigation: NavigationRow,
  Toggle: ToggleRow,
  Value: ValueRow,
};
