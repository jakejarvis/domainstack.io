import { router } from "expo-router";
import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import { AccessibilityInfo, Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { analytics } from "@/lib/analytics";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// The last-resort boundary. A render throw anywhere in the provider tree or the
// navigator lands here instead of a frozen/blank screen. The fallback is built
// from raw React Native primitives ON PURPOSE — no Uniwind, no design-system
// components — so a crash *in* the styling/UI layer can't take the recovery
// screen down with it.
function RootErrorFallback({ onReset }: { onReset: () => void }) {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // A screen-replacing crash gives no navigation cue. `accessibilityLiveRegion`
    // covers Android; iOS (VoiceOver) needs this explicit announcement.
    AccessibilityInfo.announceForAccessibility(
      "Something went wrong. The app ran into an unexpected error.",
    );
  }, []);

  const fg = isDark ? "#fafafa" : "#0a0a0a";
  const muted = isDark ? "#a1a1a1" : "#6b7280";
  const bg = isDark ? "#000000" : "#ffffff";
  const buttonBg = isDark ? "#fafafa" : "#0a0a0a";
  const buttonFg = isDark ? "#0a0a0a" : "#fafafa";

  return (
    <View
      accessibilityLiveRegion="assertive"
      style={{
        backgroundColor: bg,
        flex: 1,
        justifyContent: "center",
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
        paddingTop: insets.top + 24,
      }}
    >
      <View style={{ alignItems: "center", gap: 10 }}>
        <Text
          accessibilityRole="header"
          style={{ color: fg, fontSize: 20, fontWeight: "600", textAlign: "center" }}
        >
          Something went wrong
        </Text>
        <Text style={{ color: muted, fontSize: 15, lineHeight: 21, textAlign: "center" }}>
          The app ran into an unexpected error. You can try again — if it keeps happening, restart
          Domainstack.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onReset}
        style={({ pressed }) => ({
          alignSelf: "stretch",
          backgroundColor: buttonBg,
          borderCurve: "continuous",
          borderRadius: 14,
          marginTop: 24,
          opacity: pressed ? 0.85 : 1,
          paddingVertical: 14,
        })}
      >
        <Text style={{ color: buttonFg, fontSize: 16, fontWeight: "600", textAlign: "center" }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    analytics.trackException(error, {
      fatal: true,
      boundary: "root",
      componentStack: info.componentStack,
    });
  }

  handleReset = () => {
    // Best-effort: get the user off whatever route crashed before remounting
    // the tree. `router` can be unavailable if expo-router itself threw, so
    // never let recovery throw.
    try {
      router.replace("/");
    } catch {
      // ignore — the state reset below still gives the tree a fresh mount
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <RootErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}
