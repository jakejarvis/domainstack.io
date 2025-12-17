import type { ReactNode } from "react";
import { StaticBackground } from "@/components/layout/static-background";

export default function StaticLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex-1">
      <StaticBackground />

      <div className="container mx-auto px-3 py-8 md:px-5 md:py-12">
        {/* Glassmorphism card container */}
        <div className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-background/80 p-6 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:p-12 dark:border-white/10">
          <article className="[&>footer]:mt-12 [&>header]:mb-8 [&>section+section]:mt-8 [&>section]:scroll-mt-24 [&>section]:space-y-4 [&_a:hover]:text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h1]:font-semibold [&_h1]:text-3xl [&_h1]:tracking-tight md:[&_h1]:text-4xl [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:tracking-tight md:[&_h2]:text-2xl [&_h3]:font-medium [&_h3]:text-lg [&_h3]:tracking-tight [&_li]:leading-relaxed [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:text-muted-foreground">
            {children}
          </article>
        </div>
      </div>
    </div>
  );
}
