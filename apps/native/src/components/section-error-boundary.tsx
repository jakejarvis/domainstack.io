import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, type ErrorInfo, type ReactNode, useCallback, useState } from "react";
import { View } from "react-native";

import { analytics } from "@/lib/analytics";

import { Button } from "./button";
import { Card } from "./card";
import { Text } from "./text";

interface BoundaryProps {
  children: ReactNode;
  sectionName: string;
  resetKey: number;
  onReset: () => void;
}

interface BoundaryState {
  error: Error | null;
  resetKey: number;
}

class ErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    analytics.trackException(error, {
      section: this.props.sectionName,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <Card>
          <View className="gap-1">
            <Text className="text-base font-semibold">{this.props.sectionName} failed</Text>
            <Text className="text-sm text-muted-foreground">
              {this.state.error.message || "Something went wrong."}
            </Text>
          </View>
          <Button onPress={this.props.onReset} variant="secondary">
            <Text>Try again</Text>
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

export function SectionErrorBoundary({
  children,
  sectionName,
}: {
  children: ReactNode;
  sectionName: string;
}) {
  const { reset } = useQueryErrorResetBoundary();
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    reset();
    setResetKey((key) => key + 1);
  }, [reset]);

  return (
    <ErrorBoundaryInner onReset={handleReset} resetKey={resetKey} sectionName={sectionName}>
      {children}
    </ErrorBoundaryInner>
  );
}
