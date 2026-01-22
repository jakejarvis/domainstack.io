import {
  CheckIcon,
  HeartBreakIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { useCallback, useReducer } from "react";
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
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAnalytics } from "@/lib/analytics/client";
import { deleteUser } from "@/lib/auth-client";

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

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
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
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        { action: "delete_account" },
      );
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
              <AlertDialogMedia className="bg-green-100 dark:bg-green-900/30">
                <CheckIcon className="text-green-600 dark:text-green-400" />
              </AlertDialogMedia>
              <AlertDialogTitle>Check your email</AlertDialogTitle>
              <AlertDialogDescription>
                We&apos;ve sent a confirmation link to your email address. Click
                the link to permanently delete your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogCancel
                onClick={() => handleOpenChange(false)}
                className="cursor-pointer"
              >
                Close
              </AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <WarningIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3">
              <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <p className="mb-3">
                  The following data will be{" "}
                  <span className="font-medium">permanently deleted:</span>
                </p>
                <ul className="list-disc space-y-2 pl-4 text-foreground/80 marker:text-destructive">
                  <li>All your tracked domains</li>
                  <li>Notification preferences</li>
                  <li>Subscription data</li>
                  <li>Account information</li>
                </ul>
              </div>
              <p className="text-center text-[13px] text-muted-foreground">
                You will receive an email with a link to confirm this action.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm"
              >
                {errorMessage}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isLoading}
                className="cursor-pointer"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
                className="cursor-pointer"
              >
                {isLoading ? (
                  <Spinner />
                ) : (
                  <HeartBreakIcon aria-hidden="true" />
                )}
                I'm sure.
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
