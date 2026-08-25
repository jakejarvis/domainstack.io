"use client";

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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getConfirmDialogContent(pendingAction).title}</AlertDialogTitle>
            <AlertDialogDescription>
              {getConfirmDialogContent(pendingAction).description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              variant={getConfirmDialogContent(pendingAction).variant}
            >
              {getConfirmDialogContent(pendingAction).confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
