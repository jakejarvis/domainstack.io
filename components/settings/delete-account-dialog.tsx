"use client";

import { AlertTriangle, CheckCircle2, HeartCrack } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
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
              <AlertDialogCancel
                onClick={() => handleOpenChange(false)}
                className="cursor-pointer leading-none"
              >
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

            <div className="space-y-3">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <ul className="list-disc space-y-2 pl-4 text-sm marker:text-destructive">
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
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
                {errorMessage}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={state === "loading"}
                className="cursor-pointer leading-none"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={state === "loading"}
                className="cursor-pointer leading-none"
              >
                {state === "loading" ? (
                  <>
                    <Spinner />
                    Loading...
                  </>
                ) : (
                  <>
                    <HeartCrack />
                    I'm sure.
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
