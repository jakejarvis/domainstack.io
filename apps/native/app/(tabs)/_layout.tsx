import { Tabs } from "expo-router";
import { Text as NativeText } from "react-native";

import { authClient } from "@/lib/auth";

function TabGlyph({ focused, label }: { focused: boolean; label: string }) {
  return (
    <NativeText
      className={focused ? "text-brand text-sm font-bold" : "text-text-secondary text-sm"}
    >
      {label}
    </NativeText>
  );
}

export default function TabsLayout() {
  const session = authClient.useSession();
  const isSignedIn = Boolean(session.data?.user);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#08110e" },
        tabBarActiveTintColor: "#4ade80",
        tabBarInactiveTintColor: "#afbeb5",
        tabBarStyle: {
          backgroundColor: "rgba(8, 17, 14, 0.88)",
          borderTopColor: "rgba(255, 255, 255, 0.12)",
        },
      }}
    >
      <Tabs.Protected guard={isSignedIn}>
        <Tabs.Screen
          name="domains"
          options={{
            title: "Domains",
            tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="D" />,
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="lookup"
        options={{
          title: "Lookup",
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="L" />,
        }}
      />
      <Tabs.Protected guard={isSignedIn}>
        <Tabs.Screen
          name="notifications"
          options={{
            title: "Alerts",
            tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="N" />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="S" />,
          }}
        />
      </Tabs.Protected>
    </Tabs>
  );
}
