"use client";

import { useRef } from "react";

import { DASHBOARD_RESULTS_ID } from "@/components/dashboard/dashboard-content";
import { type ConfirmAction, getConfirmDialogContent } from "@/lib/dashboard-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@domainstack/ui/alert-dialog";

type DashboardConfirmDialogProps = {
  pendingAction: ConfirmAction | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DashboardConfirmDialog({
  pendingAction,
  onOpenChange,
  onConfirm,
}: DashboardConfirmDialogProps) {
  return (
    <AlertDialog open={pendingAction !== null} onOpenChange={onOpenChange}>
      {pendingAction && (
        <DashboardConfirmDialogContent pendingAction={pendingAction} onConfirm={onConfirm} />
      )}
    </AlertDialog>
  );
}

/** Mounted per open, so the refs start fresh for every confirmation. */
function DashboardConfirmDialogContent({
  pendingAction,
  onConfirm,
}: {
  pendingAction: ConfirmAction;
  onConfirm: () => void;
}) {
  const { title, description, confirmLabel, variant } = getConfirmDialogContent(pendingAction);
  const actionRef = useRef<HTMLButtonElement>(null);
  const confirmedRef = useRef(false);

  return (
    <AlertDialogContent
      // Reversible actions (archive) focus the action, so the hotkey then Enter confirms.
      // Destructive ones keep the default: Cancel, so a stray Enter can't delete.
      initialFocus={variant === "destructive" ? true : actionRef}
      // A confirmed action removes the focused domain, so land on the results region.
      // Focused here rather than returned: Base UI swaps a non-tabbable target for its
      // first tabbable child, which would be a domain card again.
      finalFocus={(closeType) => {
        const results = document.getElementById(DASHBOARD_RESULTS_ID);
        if (!confirmedRef.current || !results) return true;
        queueMicrotask(() =>
          results.focus({ preventScroll: true, focusVisible: closeType === "keyboard" }),
        );
        return false;
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          ref={actionRef}
          onClick={() => {
            confirmedRef.current = true;
            onConfirm();
          }}
          variant={variant}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
