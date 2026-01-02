import { Suspense } from "react";
import { StaticBackground } from "@/components/layout/static-background";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex-1">
      <StaticBackground />

      <div className="container mx-auto md:py-6">
        <Suspense
          fallback={
            <Card className="overflow-hidden py-48">
              <CardContent>
                <div className="mx-auto flex items-center justify-center gap-2 font-medium text-lg">
                  <Spinner />
                  Loading...
                </div>
              </CardContent>
            </Card>
          }
        >
          {children}
        </Suspense>
      </div>
    </div>
  );
}
