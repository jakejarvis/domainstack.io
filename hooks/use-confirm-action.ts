import { useCallback, useState } from "react";

export type ConfirmAction =
  | { type: "remove"; domainId: string; domainName: string }
  | { type: "archive"; domainId: string; domainName: string }
  | { type: "bulk-archive"; domainIds: string[]; count: number }
  | { type: "bulk-delete"; domainIds: string[]; count: number };

export type ConfirmDialogContent = {
  title: string;
  description: string;
  confirmLabel: string;
  variant: "default" | "destructive";
};

function getConfirmDialogContent(
  action: ConfirmAction | null,
): ConfirmDialogContent {
  if (!action) {
    return {
      title: "",
      description: "",
      confirmLabel: "",
      variant: "default",
    };
  }

  switch (action.type) {
    case "remove":
      return {
        title: "Remove domain?",
        description: `Are you sure you want to stop tracking ${action.domainName}?`,
        confirmLabel: "Remove",
        variant: "destructive",
      };
    case "archive":
      return {
        title: "Archive domain?",
        description: `Are you sure you want to archive ${action.domainName}? You can reactivate it later from the Archived section.`,
        confirmLabel: "Archive",
        variant: "default",
      };
    case "bulk-archive":
      return {
        title: `Archive ${action.count} domains?`,
        description: `Are you sure you want to archive ${action.count} domain${action.count === 1 ? "" : "s"}? You can reactivate them later from the Archived section.`,
        confirmLabel: "Archive All",
        variant: "default",
      };
    case "bulk-delete":
      return {
        title: `Delete ${action.count} domains?`,
        description: `Are you sure you want to stop tracking ${action.count} domain${action.count === 1 ? "" : "s"}?`,
        confirmLabel: "Delete All",
        variant: "destructive",
      };
  }
}

type UseConfirmActionOptions = {
  onConfirm: (action: ConfirmAction) => void;
};

export function useConfirmAction({ onConfirm }: UseConfirmActionOptions) {
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(
    null,
  );

  const requestConfirmation = useCallback((action: ConfirmAction) => {
    setPendingAction(action);
  }, []);

  const confirm = useCallback(() => {
    if (pendingAction) {
      onConfirm(pendingAction);
      setPendingAction(null);
    }
  }, [pendingAction, onConfirm]);

  const cancel = useCallback(() => {
    setPendingAction(null);
  }, []);

  const dialogContent = getConfirmDialogContent(pendingAction);

  return {
    pendingAction,
    dialogContent,
    requestConfirmation,
    confirm,
    cancel,
    isOpen: pendingAction !== null,
  };
}
