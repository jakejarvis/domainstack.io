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
import type { ConfirmDialogContent } from "@/hooks/use-confirm-action";

type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ConfirmDialogContent;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  open,
  onOpenChange,
  content,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            variant={content.variant}
            className="cursor-pointer"
          >
            {content.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
