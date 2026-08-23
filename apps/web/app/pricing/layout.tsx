import { StaticBackground } from "@/components/layout/static-background";

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1">
      <StaticBackground />

      <div className="container mx-auto px-3 py-8 md:px-5 md:py-16">
        <div className="mx-auto max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
