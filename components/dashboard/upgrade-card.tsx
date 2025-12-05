"use client";

import { Crown, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { checkout } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";
import { PRO_TIER_INFO } from "@/lib/polar/products";

export function UpgradeCard() {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      await checkout({
        products: [
          PRO_TIER_INFO.monthly.productId,
          PRO_TIER_INFO.yearly.productId,
        ],
      });
    } catch (err) {
      logger.error("Failed to open checkout", err);
      toast.error("Failed to open checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/20 via-accent-purple/10 to-accent-blue/20 py-0">
      {/* Decorative elements */}
      <div
        aria-hidden
        className="-right-8 -top-8 pointer-events-none absolute size-32 rounded-full bg-accent-purple/30 blur-3xl"
      />
      <div
        aria-hidden
        className="-bottom-8 -left-8 pointer-events-none absolute size-24 rounded-full bg-accent-blue/30 blur-3xl"
      />

      <CardContent className="relative flex h-full flex-1 flex-col items-center p-6 text-center">
        {/* Icon */}
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-purple/20">
          <Crown className="size-7 text-accent-purple" />
        </div>

        {/* Heading */}
        <h3 className="mb-2 font-semibold text-lg">Upgrade to Pro</h3>

        {/* Value prop */}
        <p className="mb-4 text-muted-foreground text-sm">
          Track up to 50 domains with priority notifications
        </p>

        {/* Pricing */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-accent-purple">
            {PRO_TIER_INFO.monthly.label}
          </span>
          <span className="text-muted-foreground">or</span>
          <span className="font-medium text-accent-purple">
            {PRO_TIER_INFO.yearly.label}
          </span>
        </div>

        {/* Spacer to ensure minimum gap above button */}
        <div className="min-h-4 flex-1" />

        {/* CTA Button - pushed to bottom */}
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full bg-accent-purple hover:bg-accent-purple/90"
        >
          <Sparkles className="size-4" />
          {isLoading ? "Opening..." : "Get Pro"}
        </Button>
      </CardContent>
    </Card>
  );
}
