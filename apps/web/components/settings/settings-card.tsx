import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@domainstack/ui/card";
import { Separator } from "@domainstack/ui/separator";
import { cn } from "@domainstack/ui/utils";

function SettingsCard({
  title,
  description,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  title: string | React.ReactNode;
  description: string | React.ReactNode;
}) {
  return (
    <div
      data-slot="settings-card"
      className={cn("space-y-4", className)}
      {...props}
    >
      <CardHeader className="gap-1 px-0 pt-0">
        <CardTitle className="text-[15px]">{title}</CardTitle>
        <CardDescription className="text-[13px]">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </div>
  );
}

function SettingsCardSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="settings-card-separator"
      orientation="horizontal"
      className={cn("my-6 bg-muted", className)}
      {...props}
    />
  );
}

export { SettingsCard, SettingsCardSeparator };
