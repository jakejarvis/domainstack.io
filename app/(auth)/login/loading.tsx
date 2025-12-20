import { LoginSkeleton } from "@/components/auth/login-skeleton";
import { AnimatedBackground } from "@/components/layout/animated-background";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function LoginLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <AnimatedBackground />
      <Card
        className={cn(
          "max-w-md",
          // Frosted glass in both light + dark mode (with a bit more presence in light mode).
          "border-black/15 bg-background/75 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 dark:border-white/8 dark:bg-background/65 dark:ring-white/5 dark:supports-[backdrop-filter]:bg-background/55",
        )}
      >
        <LoginSkeleton />
      </Card>
    </div>
  );
}
