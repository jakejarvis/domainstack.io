import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import {
  Component,
  createContext,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import { analytics } from "@/lib/analytics";

import { QueryErrorState } from "./query-error-state";

/**
 * Lets a parent (e.g. Settings) observe how many of its sibling sections are
 * currently failed so it can surface an aggregate banner. Default is a no-op,
 * so every other consumer (the domain report) is unaffected and needs no
 * provider.
 */
export type SectionErrorReporter = (sectionName: string, hasError: boolean) => void;

export const SectionErrorReporterContext = createContext<SectionErrorReporter>(() => {});

interface BoundaryProps {
  children: ReactNode;
  sectionName: string;
  resetKey: number;
  onReset: () => void;
  report: SectionErrorReporter;
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
    this.props.report(this.props.sectionName, true);
  }

  componentWillUnmount() {
    // Don't leave a stale failure counted if the section is torn down while
    // still errored (e.g. navigating away). No-op when not errored.
    if (this.state.error) this.props.report(this.props.sectionName, false);
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
  const report = useContext(SectionErrorReporterContext);

  const handleReset = useCallback(() => {
    // Optimistically clear from the aggregate; if the retry re-throws,
    // componentDidCatch re-reports it.
    report(sectionName, false);
    reset();
    setResetKey((key) => key + 1);
  }, [reset, report, sectionName]);

  return (
    <ErrorBoundaryInner
      onReset={handleReset}
      report={report}
      resetKey={resetKey}
      sectionName={sectionName}
    >
      {children}
    </ErrorBoundaryInner>
  );
}
