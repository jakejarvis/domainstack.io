import { CheckCircleIcon } from "@phosphor-icons/react/ssr";
import { IconBadge } from "@/components/ui/icon-badge";

type StepConfirmationProps = {
  domain: string;
};

export function StepConfirmation({ domain }: StepConfirmationProps) {
  return (
    <div className="space-y-4 text-center" aria-live="polite">
      <IconBadge size="lg" color="success" className="mx-auto">
        <CheckCircleIcon className="size-6" />
      </IconBadge>
      <div>
        <h3 className="font-semibold">Domain verified!</h3>
        <p className="text-muted-foreground text-sm">
          <span className="font-medium">{domain}</span> has been added to your
          dashboard. You&apos;ll receive notifications when it&apos;s about to
          expire.
        </p>
      </div>
    </div>
  );
}
