import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";
import { useSubscription } from "@/hooks/use-subscription";

export function UpgradeButton({
  className,
  variant = "default",
  size = "default",
  icon: Icon,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "disabled"> & {
  /** Icon component to display (replaced by spinner when loading) */
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const { handleCheckout, isCheckoutLoading } = useSubscription();

  return (
    <Button
      className={className}
      variant={variant}
      size={size}
      onClick={handleCheckout}
      disabled={isCheckoutLoading}
      {...props}
    >
      {isCheckoutLoading ? <Spinner /> : Icon ? <Icon /> : null}
      {children}
    </Button>
  );
}
