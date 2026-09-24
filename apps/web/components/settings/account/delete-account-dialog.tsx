import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconHeartBroken,
} from "@tabler/icons-react";
import { useCallback, useReducer } from "react";

import { useAnalytics } from "@/lib/analytics/client";
import { deleteUser } from "@domainstack/auth/client";
import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@domainstack/ui/alert-dialog";
import { Spinner } from "@domainstack/ui/spinner";

// ============================================================================
// Types
// ============================================================================

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ============================================================================
// State Machine
// ============================================================================

/**
 * Discriminated union for the delete account dialog state machine.
 * Error message is embedded in the error state - no separate useState needed.
 */
type DialogState =
  | { status: "confirm" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

type DialogAction =
  | { type: "START_DELETE" }
  | { type: "DELETE_SUCCESS" }
  | { type: "DELETE_ERROR"; message: string }
  | { type: "RESET" };

const initialState: DialogState = { status: "confirm" };

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "START_DELETE":
      return { status: "loading" };

    case "DELETE_SUCCESS":
      return { status: "success" };

    case "DELETE_ERROR":
      return { status: "error", message: action.message };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// Component
// ============================================================================

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [state, dispatch] = useReducer(dialogReducer, initialState);
  const analytics = useAnalytics();

  const handleDelete = useCallback(async () => {
    dispatch({ type: "START_DELETE" });

    try {
      const result = await deleteUser();

      if (result.error) {
        analytics.trackException(new Error(result.error.message), {
          action: "delete_account",
        });
        dispatch({
          type: "DELETE_ERROR",
          message: result.error.message || "Failed to request account deletion",
        });
        return;
      }

      analytics.track("delete_account_initiated");
      dispatch({ type: "DELETE_SUCCESS" });
    } catch (err) {
      analytics.trackException(err, {
        action: "delete_account",
      });
      dispatch({
        type: "DELETE_ERROR",
        message: "An unexpected error occurred. Please try again.",
      });
    }
  }, [analytics]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when dialog closes
        dispatch({ type: "RESET" });
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  // Derived state
  const isLoading = state.status === "loading";
  const isSuccess = state.status === "success";
  const errorMessage = state.status === "error" ? state.message : null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {isSuccess ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia variant="success">
                <IconCheck />
              </AlertDialogMedia>
              <AlertDialogTitle>Check your email</AlertDialogTitle>
              <AlertDialogDescription>
                We&apos;ve sent a confirmation link to your email address. Click the link to
                permanently delete your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogCancel onClick={() => handleOpenChange(false)}>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <IconAlertTriangle />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertTitle>This will permanently delete:</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4 marker:text-destructive">
                    <li>All your tracked domains</li>
                    <li>Notification preferences</li>
                    <li>Subscription data</li>
                    <li>Account information</li>
                  </ul>
                </AlertDescription>
              </Alert>
              <p className="text-center text-[13px] text-muted-foreground">
                You will receive an email with a link to confirm this action.
              </p>
            </div>

            {errorMessage && (
              <Alert variant="destructive">
                <IconAlertCircle aria-hidden="true" />
                <AlertTitle>Couldn&apos;t delete your account</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isLoading}>
                {isLoading ? <Spinner /> : <IconHeartBroken aria-hidden="true" />}
                I'm sure.
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
