import { Fragment } from "react";
import { View } from "react-native";

import { cn } from "@/lib/cn";

import { KeyValue } from "./key-value";

export interface KeyValueItem {
  key: string;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyable?: boolean;
}

export function KeyValueGrid({ items, className }: { items: KeyValueItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <View className={cn("gap-3", className)}>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 ? <View className="h-px bg-border" /> : null}
          <KeyValue
            copyable={item.copyable}
            label={item.label}
            mono={item.mono}
            value={item.value}
          />
        </Fragment>
      ))}
    </View>
  );
}
