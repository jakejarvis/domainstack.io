import * as WebBrowser from "expo-web-browser";
import { useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { EXTERNAL_TOOLS } from "@domainstack/constants";

export function ToolsSheet({ domain }: { domain: string }) {
  const sheetRef = useRef<AppBottomSheetRef>(null);

  return (
    <>
      <Button onPress={() => sheetRef.current?.present()} variant="secondary">
        <Text>Open in…</Text>
      </Button>
      <AppBottomSheet
        description={`Inspect ${domain} in an external tool.`}
        ref={sheetRef}
        title="Open in…"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            className="border-line bg-glass overflow-hidden rounded-2xl border"
            style={{ borderCurve: "continuous" }}
          >
            {EXTERNAL_TOOLS.map((tool, index) => (
              <Pressable
                accessibilityRole="link"
                className={index > 0 ? "border-line border-t px-4 py-3" : "px-4 py-3"}
                key={tool.name}
                onPress={() => {
                  sheetRef.current?.dismiss();
                  void WebBrowser.openBrowserAsync(tool.buildUrl(domain), {
                    dismissButtonStyle: "close",
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                  });
                }}
              >
                <Text className="font-semibold">{tool.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </AppBottomSheet>
    </>
  );
}
