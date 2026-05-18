import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, type ErrorInfo, type ReactNode, useCallback, useState } from "react";

import { analytics } from "@/lib/analytics";

import { QueryErrorState } from "./query-error-state";

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
      // No raw `error.message` dead-end: QueryErrorState distinguishes a
      // genuine offline condition from a generic failure and always offers a
      // retry. The technical detail is already captured in componentDidCatch.
      return (
        <QueryErrorState
          onRetry={this.props.onReset}
          title={`${this.props.sectionName} couldn’t load`}
        />
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
