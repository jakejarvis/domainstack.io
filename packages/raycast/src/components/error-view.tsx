import { Action, ActionPanel, Detail, Icon } from "@raycast/api";

interface ErrorViewProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

/**
 * Error view component for displaying errors with retry action.
 */
export function ErrorView({ title, message, onRetry }: ErrorViewProps) {
  const markdown = `# ${title}

${message}`;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          {onRetry && (
            <Action
              title="Retry"
              icon={Icon.RotateClockwise}
              onAction={onRetry}
            />
          )}
          <Action.OpenInBrowser
            title="Visit Domainstack"
            url="https://domainstack.io"
          />
        </ActionPanel>
      }
    />
  );
}
