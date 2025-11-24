"use client";

import { Ban } from "lucide-react";
import posthog from "posthog-js";
import type { ReactNode } from "react";
import { Component } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createLogger } from "@/lib/logger/client";

interface Props {
  children: ReactNode;
  sectionName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for individual domain sections.
 * Catches rendering errors and provides a fallback UI without crashing the entire page.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  private logger = createLogger({ component: "SectionErrorBoundary" });

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    // Log to PostHog for monitoring
    posthog.captureException(error, {
      section: this.props.sectionName,
      componentStack: errorInfo.componentStack,
    });

    this.logger.error("render error", error, {
      section: this.props.sectionName,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <Ban className="size-4" />
          <AlertTitle>Failed to load section</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3">
            <p className="text-sm">
              {process.env.NODE_ENV === "development" && this.state.error
                ? this.state.error.message
                : "This section encountered an error and couldn't be displayed."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-fit"
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
