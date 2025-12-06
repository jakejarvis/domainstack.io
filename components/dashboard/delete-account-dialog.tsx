"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAnalytics } from "@/lib/analytics/client";
import { deleteUser } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DialogState = "confirm" | "loading" | "success" | "error";

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const [state, setState] = useState<DialogState>("confirm");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const analytics = useAnalytics();

  const handleDelete = async () => {
    setState("loading");
    setErrorMessage(null);

    try {
      const result = await deleteUser();

      if (result.error) {
        logger.error("Failed to request account deletion", result.error);
        setErrorMessage(
          result.error.message || "Failed to request account deletion",
        );
        setState("error");
        return;
      }

      analytics.track("delete_account_initiated");
      setState("success");
    } catch (err) {
      logger.error("Failed to request account deletion", err);
      setErrorMessage("An unexpected error occurred. Please try again.");
      setState("error");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when dialog closes
      setState("confirm");
      setErrorMessage(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {state === "success" ? (
          <>
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <AlertDialogTitle className="text-center">
                Check your email
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                We&apos;ve sent a confirmation link to your email address. Click
                the link to permanently delete your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogCancel onClick={() => handleOpenChange(false)}>
                Close
              </AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-center">
                Delete your account?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                This action cannot be undone. The following will be permanently
                deleted:
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-destructive">•</span>
                  <span>All your tracked domains</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-destructive">•</span>
                  <span>Notification preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-destructive">•</span>
                  <span>Subscription data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-destructive">•</span>
                  <span>Account information</span>
                </li>
              </ul>
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
                {errorMessage}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={state === "loading"}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={state === "loading"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  "Delete Account"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
