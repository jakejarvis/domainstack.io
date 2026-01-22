import { CheckCircleIcon } from "@phosphor-icons/react/ssr";
import { Icon } from "@/components/ui/icon";

type StepConfirmationProps = {
  domain: string;
};

export function StepConfirmation({ domain }: StepConfirmationProps) {
  return (
    <div className="space-y-4 text-center" aria-live="polite">
      <Icon size="lg" variant="success" className="mx-auto">
        <CheckCircleIcon />
      </Icon>
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
