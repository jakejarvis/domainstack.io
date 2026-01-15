import { CheckCircleIcon } from "@phosphor-icons/react/ssr";

type StepConfirmationProps = {
  domain: string;
};

export function StepConfirmation({ domain }: StepConfirmationProps) {
  return (
    <div className="space-y-4 text-center" aria-live="polite">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
        <CheckCircleIcon className="size-6 text-success-foreground" />
      </div>
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
