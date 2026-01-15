import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSubscription } from "@/hooks/use-subscription";

export function UpgradeButton({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "disabled"> & {
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
      {isCheckoutLoading ? (
        <>
          <Spinner />
          Loading…
        </>
      ) : (
        children
      )}
    </Button>
  );
}
